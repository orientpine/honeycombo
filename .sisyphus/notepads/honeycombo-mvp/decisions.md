#KM|- Followed the requested reusable workflow pattern with a fixed content-update concurrency group.
#KM|- Kept CI minimal: validate, build, and test only; no matrix or deploy workflow added.
- Validation script scans curated articles and feed articles recursively, checks schemas, and treats duplicate URLs as warnings only.
