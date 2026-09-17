#!/usr/bin/env bash
#
# Vercel build: refresh the data, retrain the model, then build the site.
#
# This is what makes the model current without anyone running anything. Every
# deploy re-reads the published record, retrains on whatever races have
# happened since, checks the result and only then builds the front end.
#
# It is written to DEGRADE rather than fail. The trained model is committed, so
# each step that cannot run leaves the previous artifact in place and the site
# still ships:
#
#   no python or xgboost   -> build with the committed model
#   the record unreachable -> retrain on the committed corpus
#   training fails         -> build with the committed model
#   parity check fails     -> STOP. This one is fatal on purpose: it means the
#                             browser would score drivers differently from the
#                             model that was just validated, and shipping that
#                             is worse than not deploying.
#
set -uo pipefail

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
warn() { printf '    ! %s\n' "$1"; }

PY=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
done

train_ok=0

if [ -z "$PY" ]; then
  warn "no python on this builder; keeping the committed model"
else
  say "Installing training dependencies ($($PY --version 2>&1))"
  # Into a virtualenv rather than the system interpreter. Vercel's builder
  # would usually allow a plain install, but a Homebrew or Debian Python
  # refuses one outright ("externally-managed-environment"), and a venv is the
  # one approach that behaves the same everywhere — including locally, so this
  # script can be tested on the machine that wrote it.
  VENV="${TMPDIR:-/tmp}/gridpred-model-venv"
  if $PY -m venv "$VENV" >/dev/null 2>&1 && \
     "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check \
      -r tools/requirements-model.txt; then
    PY="$VENV/bin/python"

    say "Refreshing the training corpus"
    # Jolpica is a free shared API. If it is slow or down, the committed corpus
    # is used — a model trained on last week's races beats no deploy.
    if ! $PY tools/fetch_training_data.py; then
      warn "corpus refresh failed; training on the committed corpus"
    fi

    say "Training"
    if $PY tools/train_model.py; then
      train_ok=1
    else
      warn "training failed; keeping the committed model"
    fi
  else
    warn "could not install xgboost; keeping the committed model"
  fi
fi

say "Verifying train/serve parity"
if ! node tools/verify_model.mjs; then
  echo
  echo "    The JavaScript evaluator disagrees with the trained model."
  echo "    Refusing to deploy a model the browser would score differently."
  exit 1
fi

if [ "$train_ok" -eq 1 ]; then
  say "Model retrained for this deploy"
else
  say "Using the committed model"
fi

say "Building the site"
exec npm run build
