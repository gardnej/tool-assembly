#!/usr/bin/env bash
# Link (or copy) the Tool Assembly add-in into Fusion's AddIns folder.
#
#   ./scripts/install-addin.sh          # symlink, so edits are picked up in place
#   ./scripts/install-addin.sh --copy   # copy, if Fusion refuses to load a link
#   ./scripts/install-addin.sh --remove
set -euo pipefail

ADDIN_NAME="ToolAssembly"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${REPO_ROOT}/addin/${ADDIN_NAME}"
ADDINS_DIR="${HOME}/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns"
TARGET="${ADDINS_DIR}/${ADDIN_NAME}"

mode="link"
case "${1:-}" in
  --copy) mode="copy" ;;
  --remove) mode="remove" ;;
  "") ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac

if [[ ! -d "${SOURCE}" ]]; then
  echo "Add-in source not found at ${SOURCE}" >&2
  exit 1
fi

if [[ ! -d "${ADDINS_DIR}" ]]; then
  echo "Fusion AddIns folder not found at:" >&2
  echo "  ${ADDINS_DIR}" >&2
  echo "Is Fusion installed for this user?" >&2
  exit 1
fi

# Clear any previous install, whether it was a link or a copy.
if [[ -L "${TARGET}" || -e "${TARGET}" ]]; then
  rm -rf "${TARGET}"
  echo "Removed existing ${TARGET}"
fi

case "${mode}" in
  remove)
    echo "Uninstalled ${ADDIN_NAME}."
    ;;
  link)
    ln -s "${SOURCE}" "${TARGET}"
    echo "Linked ${ADDIN_NAME} -> ${SOURCE}"
    ;;
  copy)
    # Leave build artefacts and tests behind; Fusion only needs the runtime code.
    rsync -a --exclude '__pycache__' --exclude 'tests' "${SOURCE}/" "${TARGET}/"
    echo "Copied ${ADDIN_NAME} to ${TARGET}"
    ;;
esac

if [[ "${mode}" != "remove" ]]; then
  cat <<'NEXT'

Next steps in Fusion:
  1. Switch to the Manufacture workspace (the add-in needs CAM loaded).
  2. Utilities > Add-Ins > Scripts and Add-Ins (or Shift+S).
  3. On the Add-Ins tab, select "ToolAssembly" and click Run.
  4. Look for "Build Tool Assembly" in the Manufacture toolbar.

After editing the source, stop and re-run the add-in to reload it.
NEXT
fi
