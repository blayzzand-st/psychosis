from fastapi import FastAPI


app = FastAPI(title="PsychosIS API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
