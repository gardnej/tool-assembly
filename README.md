# Turning Tool Holder — Tool Assembly Prototype

Clickable React prototype for the **Turning Tool Holder** tool assembly workflow, aligned with the [Figma design](https://www.figma.com/design/6umxPtr1MHVMqbXl6fMGXn/Turning-Tool-Holder?node-id=1896-61951) and **[My Prototype](/Users/jasongardner/Cursor/My Prototype)** Fusion shell (browser, ribbon, viewport) plus **Fusion Dark Blue** tool library dialogue (Artifakt Element).

## Workflow

1. App opens in the **Manufacture** workspace (**Milling** tab) with Fusion main view (menu bar, document tabs, ribbon, browser, 3D viewport).
2. Click **Tool library** on the ribbon → the **Tool Library** browser opens (library tree, tool table, cutting data, info preview).
3. Click **+** (New tool) in the centre toolbar → the **New tool** type picker opens with categories (Milling, Turning, etc.).
4. Select **Tool Assembly** (first option at the top) → the **Turning Tool Holder** assembly dialogue opens for creating a new tool block.
5. Deep-link: `?toolLibrary=1` opens the Tool Library browser on load.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5174

## Workflow

1. **Select tool holder** — pick a tool block from the component library, click **Add to Assembly**
2. **Add compatible insert** — assign inserts, clamps, screws, and adapters to slots
3. **Configure** — set orientation, connection types, stick-out, and dimensions
4. **Validate** — run compatibility checks (warnings/errors)
5. **Review** — confirm the completed assembly summary

## Structure

- `src/components/` — reusable UI (header, canvas, grid, steps, panels, buttons)
- `src/data/` — placeholder catalog and workflow metadata
- `src/hooks/useToolAssemblyWorkflow.ts` — local React state (no backend)

## Integration points (commented in code)

- Fusion Tool Library API
- Neutron / viewport graphics
- CAM compatibility validation service
