#KM|- Followed the requested reusable workflow pattern with a fixed content-update concurrency group.
#KM|- Kept CI minimal: validate, build, and test only; no matrix or deploy workflow added.
- Validation script scans curated articles and feed articles recursively, checks schemas, and treats duplicate URLs as warnings only.
- The RSS collector exports normalization helpers and accepts injectable fetch/output paths so unit tests can validate dedupe, spam filtering, and malformed XML without network access.
- The scheduled RSS workflow commits only `src/data/feeds/` changes and reuses the shared `content-update` concurrency contract.
