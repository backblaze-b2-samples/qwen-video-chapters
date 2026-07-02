from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Backblaze B2 (S3-compatible). Standardized B2_* env var names.
    # The S3 endpoint is derived from the region (e.g. for region us-west-004:
    #   https://s3.us-west-004.backblazeb2.com). Required at startup — empty
    # default so test collection / `from main import app` never raises; the
    # lifespan check fails fast with a readable message if it's unset.
    b2_region: str = ""
    b2_application_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    # Optional public base URL for objects. The video player uses presigned
    # URLs, so this is not required.
    b2_public_url_base: str = ""

    api_port: int = 8000
    # Explicit allowlist by default — covers Next on :3000 and the
    # fallback :3001 it picks if 3000 is busy. Production deploys should
    # override with the exact frontend origin.
    api_cors_origins: str = "http://localhost:3000,http://localhost:3001"
    # Optional dev-only escape hatch: a regex that matches additional
    # allowed origins. Empty by default — set this to e.g.
    # `^http://localhost:\d+$` to accept any localhost port without
    # listing each one. NEVER ship this to production.
    api_cors_origin_regex: str = ""

    # Upload limits. Source-video ingest from the browser is capped separately
    # (see service/library.py) — large production videos are dropped directly
    # into B2 under library/source/ instead.
    max_file_size: int = 100 * 1024 * 1024  # 100MB

    # --- Qwen2.5-VL (local, on-device) chapter generation ---
    # Device autodetect order is CUDA -> Apple MPS -> CPU. Set QWEN_DEVICE to
    # force one (e.g. "cpu", "cuda", "mps"). Default model is the ungated 3B.
    qwen_model_id: str = "Qwen/Qwen2.5-VL-3B-Instruct"
    qwen_device: str = ""  # "" => autodetect
    # Demo feasibility: cap the keyframes fed to the model and the max
    # chapters it may emit. Production would lift these + use a job queue/GPU.
    max_keyframes: int = 16
    # Cap per-frame resolution handed to the vision encoder. Qwen2.5-VL's
    # processor otherwise allows ~12.8M px/frame (thousands of vision tokens
    # each) — a full-res 16-frame prompt then blows up MPS/GPU memory (OOM). A
    # downscaled frame (~448px, up to 256 vision tokens) is plenty to identify a
    # scene for chaptering. Raise it if you have headroom and want more detail.
    qwen_max_pixels: int = 256 * 28 * 28

    # Small durable counters (downloads, etc). Point at a persistent
    # volume in production if you care about surviving restarts.
    download_count_file: str = "data/download_count.json"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def b2_endpoint(self) -> str:
        """Derive the S3 endpoint URL from the configured B2 region."""
        return f"https://s3.{self.b2_region}.backblazeb2.com"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]


settings = Settings()
