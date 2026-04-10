#KM|- Use workflow_dispatch on both CI and reusable content workflows to keep manual verification and maintenance easy.
#KM|- Keep content-update concurrency serialized with cancel-in-progress false to avoid overlapping pushes.
- Bun can validate this repo directly with `bun run validate`; duplicate URLs are reported as warnings without failing the run.
