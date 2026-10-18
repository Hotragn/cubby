"""Fine-tune a small open model to read daycare notes into events, on Tinker.

Student: Qwen3.5-4B + LoRA. Teacher labels: Gemma 4 26B A4B (the app's own reader) on SYNTHETIC training days
(evals/train, seeds never used for the held-out set), kept only if they pass Cubby's checks.
Then the student reads every note of the held-out set; outputs are saved in the same
format as the Gemma runs, and scored by the same code (node evals/run.ts with RESCORE=1).

Run: .venv/bin/python ml/train_tinker.py
"""
import json, os, random, time, glob, concurrent.futures as cf
import tinker
from tinker import types

for line in open(".env"):
    if line.startswith("TINKER="): os.environ["TINKER_API_KEY"] = line.split("=", 1)[1].strip()

BASE = os.environ.get("BASE", "Qwen/Qwen3.5-4B")
RANK, LR, BATCH, EPOCHS = 32, 3e-4, 32, 2
TAG = "tinker-" + BASE.split("/")[-1].lower()
SYSTEM = ("You turn one quick note from a home daycare provider into JSON events. Copy, never judge or guess. "
          "Types: arrive, depart, staff_in, staff_out, meal, bottle, nap, sleep_check, diaper, incident, med, mood, activity, note. "
          "Fields: kids (roster names, or [\"all\"] only if the note says all), quote (exact words from the note), time (as written, \"now\" or null), "
          "nap: start/end; meal: food, meal, amount (all|most|half|some|little|none); bottle: oz; diaper: kind (wet|bm|dry|wet+bm), toilet; "
          "incident: what, body, action, by; med: med, dose, by; arrive/depart: by; staff_in/staff_out: staff; sleep_check: by, position; mood: mood; activity/note: what. "
          "If unclear, leave the field null and add a question. Output {\"events\":[...],\"questions\":[...]}.")

def msgs(roster, staff, note):
    return [{"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Roster: {', '.join(roster)}\nAdults: {', '.join(staff)}\nNote (logged {note['t']}): {note['text']}"}]

def main():
    sc = tinker.ServiceClient()
    tc = sc.create_lora_training_client(base_model=BASE, rank=RANK)
    tok = tc.get_tokenizer()

    def enc(m):
        try: x = tok.apply_chat_template(m, add_generation_prompt=True, tokenize=True, enable_thinking=False)
        except TypeError: x = tok.apply_chat_template(m, add_generation_prompt=True, tokenize=True)
        return list(x["input_ids"]) if not isinstance(x, list) else list(x)

    def datum(e):
        p = enc(msgs(e["roster"], e["staff"], e["note"]))
        c = tok.encode(json.dumps(e["target"], separators=(",", ":")), add_special_tokens=False) + [tok.eos_token_id]
        toks = p + c; w = [0.0] * len(p) + [1.0] * len(c)
        return types.Datum(model_input=types.ModelInput.from_ints(toks[:-1]), loss_fn_inputs={"target_tokens": toks[1:], "weights": w[1:]})

    train = [json.loads(l) for l in open("evals/train/labels.jsonl") if l.strip()]
    rnd = random.Random(7)
    log = {"base": BASE, "rank": RANK, "lr": LR, "batch": BATCH, "epochs": EPOCHS, "n_train": len(train), "losses": [], "tokens": 0}
    t0 = time.time(); step = 0; total = EPOCHS * ((len(train) + BATCH - 1) // BATCH)
    for ep in range(EPOCHS):
        rnd.shuffle(train)
        for b in range(0, len(train), BATCH):
            batch = [datum(e) for e in train[b:b + BATCH]]
            log["tokens"] += sum(d.model_input.length for d in batch)
            fb = tc.forward_backward(batch, "cross_entropy")
            op = tc.optim_step(types.AdamParams(learning_rate=LR * max(0.1, 1 - step / total)))
            out = fb.result(); op.result()
            tot = wsum = 0.0
            for d, o in zip(batch, out.loss_fn_outputs):
                lp = o["logprobs"].tolist() if hasattr(o["logprobs"], "tolist") else o["logprobs"].data
                ws = d.loss_fn_inputs["weights"].tolist() if hasattr(d.loss_fn_inputs["weights"], "tolist") else d.loss_fn_inputs["weights"].data
                tot += -sum(a * b for a, b in zip(lp, ws)); wsum += sum(ws)
            log["losses"].append(round(tot / max(wsum, 1), 4)); step += 1
            if step % 5 == 1: print(f"step {step}/{total} loss {log['losses'][-1]:.4f} ({time.time() - t0:.0f}s)", flush=True)
    saved = tc.save_weights_for_sampler(name="cubby-reader-lora-v1").result()
    log["sampler_path"] = saved.path; log["train_seconds"] = round(time.time() - t0)
    os.makedirs("ml/out", exist_ok=True); json.dump(log, open("ml/out/run.json", "w"), indent=1)
    print("trained", log["train_seconds"], "s on", len(train), "notes", flush=True)

    sampler = sc.create_sampling_client(model_path=saved.path)
    params = types.SamplingParams(max_tokens=700, temperature=0.0, stop=[tok.eos_token])
    for dset in ["holdout", "days"]:
        outdir = f"evals/raw/{TAG}/{dset}"; os.makedirs(outdir, exist_ok=True)
        for f in sorted(glob.glob(f"evals/{dset}/*.json")):
            day = json.load(open(f)); roster = [c["name"] for c in day["roster"]]; staff = [s["name"] for s in day["staff"]]
            t1 = time.time()
            futs = [(n, sampler.sample(types.ModelInput.from_ints(enc(msgs(roster, staff, n))), 1, params)) for n in day["notes"]]
            raw, inT, outT, bad = {}, 0, 0, 0
            for n, fu in futs:
                r = fu.result(); toks = r.sequences[0].tokens; outT += len(toks)
                txt = tok.decode(toks, skip_special_tokens=True).strip()
                try: raw[n["id"]] = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
                except Exception: raw[n["id"]] = {"events": [], "questions": [{"quote": n["text"], "ask": "The reader couldn't process this note. Please check it by hand."}], "failed": True}; bad += 1
            wall = int((time.time() - t1) * 1000)
            json.dump({"model": TAG, "wallMs": wall, "usage": {"calls": len(futs), "inTokens": inT, "outTokens": outT, "ms": wall, "cached": 0, "retries": 0, "model": TAG, "unparsed": bad}, "raw": raw}, open(f"{outdir}/{day['id']}.json", "w"))
            print(dset, day["id"], f"{wall/1000:.1f}s", "unparsed", bad, flush=True)

if __name__ == "__main__":
    main()
