import { useState } from "react";
import "./App.css";

type DataType = "int" | "float" | "bool" | "string";
type MathOperator = "+" | "-" | "*" | "/" | "%";
type LogicOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "and" | "or";

type Block =
  | {
      id: number;
      type: "variable";
      dataType: DataType;
      name: string;
      value: string;
    }
  | {
      id: number;
      type: "calculation";
      left: string;
      operator: MathOperator;
      right: string;
    }
  | {
      id: number;
      type: "logic";
      left: string;
      operator: LogicOperator;
      right: string;
    }
  | {
      id: number;
      type: "print";
      value: string;
    }
  | {
      id: number;
      type: "if";
      condition: string;
      children: Block[];
    }
  | {
      id: number;
      type: "while";
      condition: string;
      children: Block[];
    }
  | {
      id: number;
      type: "for";
      variable: string;
      start: string;
      end: string;
      children: Block[];
    }
  | {
      id: number;
      type: "tryCatch";
      catchErrorName: string;
      tryChildren: Block[];
      catchChildren: Block[];
    };

type BlockType = Block["type"];

type DropTarget =
  | {
      area: "root";
      index: number;
    }
  | {
      area: "children";
      parentId: number;
      index: number;
    }
  | {
      area: "tryChildren";
      parentId: number;
      index: number;
    }
  | {
      area: "catchChildren";
      parentId: number;
      index: number;
    };

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [result, setResult] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);

  function makeId() {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  function getInputWidth(value: string, minWidth = 72, maxWidth = 240) {
    const textLength = value.length === 0 ? 4 : value.length;
    const calculatedWidth = textLength * 8 + 18;
    return Math.min(Math.max(minWidth, calculatedWidth), maxWidth);
  }

  function createBlock(type: BlockType): Block {
    const id = makeId();

    if (type === "variable") {
      return {
        id,
        type: "variable",
        dataType: "int",
        name: "",
        value: "",
      };
    }

    if (type === "calculation") {
      return {
        id,
        type: "calculation",
        left: "",
        operator: "+",
        right: "",
      };
    }

    if (type === "logic") {
      return {
        id,
        type: "logic",
        left: "",
        operator: "==",
        right: "",
      };
    }

    if (type === "print") {
      return {
        id,
        type: "print",
        value: "",
      };
    }

    if (type === "if") {
      return {
        id,
        type: "if",
        condition: "",
        children: [],
      };
    }

    if (type === "while") {
      return {
        id,
        type: "while",
        condition: "",
        children: [],
      };
    }

    if (type === "for") {
      return {
        id,
        type: "for",
        variable: "i",
        start: "0",
        end: "10",
        children: [],
      };
    }

    return {
      id,
      type: "tryCatch",
      catchErrorName: "error",
      tryChildren: [],
      catchChildren: [],
    };
  }

  function getDropTargetKey(target: DropTarget) {
    if (target.area === "root") {
      return `root-${target.index}`;
    }

    return `${target.area}-${target.parentId}-${target.index}`;
  }

  function insertIntoBlocks(
    blockList: Block[],
    target: DropTarget,
    newBlock: Block
  ): Block[] {
    if (target.area === "root") {
      const updated = [...blockList];
      updated.splice(target.index, 0, newBlock);
      return updated;
    }

    return blockList.map((block) => {
      if (block.id === target.parentId) {
        if (
          target.area === "children" &&
          (block.type === "if" ||
            block.type === "while" ||
            block.type === "for")
        ) {
          const updatedChildren = [...block.children];
          updatedChildren.splice(target.index, 0, newBlock);

          return {
            ...block,
            children: updatedChildren,
          };
        }

        if (target.area === "tryChildren" && block.type === "tryCatch") {
          const updatedTryChildren = [...block.tryChildren];
          updatedTryChildren.splice(target.index, 0, newBlock);

          return {
            ...block,
            tryChildren: updatedTryChildren,
          };
        }

        if (target.area === "catchChildren" && block.type === "tryCatch") {
          const updatedCatchChildren = [...block.catchChildren];
          updatedCatchChildren.splice(target.index, 0, newBlock);

          return {
            ...block,
            catchChildren: updatedCatchChildren,
          };
        }
      }

      if (block.type === "if" || block.type === "while" || block.type === "for") {
        return {
          ...block,
          children: insertIntoBlocks(block.children, target, newBlock),
        };
      }

      if (block.type === "tryCatch") {
        return {
          ...block,
          tryChildren: insertIntoBlocks(block.tryChildren, target, newBlock),
          catchChildren: insertIntoBlocks(block.catchChildren, target, newBlock),
        };
      }

      return block;
    });
  }

  function removeBlockById(
    blockList: Block[],
    id: number
  ): { updatedBlocks: Block[]; removedBlock: Block | null } {
    let removedBlock: Block | null = null;

    const updatedBlocks = blockList
      .map((block) => {
        if (block.id === id) {
          removedBlock = block;
          return null;
        }

        if (block.type === "if" || block.type === "while" || block.type === "for") {
          const result = removeBlockById(block.children, id);

          if (result.removedBlock) {
            removedBlock = result.removedBlock;
          }

          return {
            ...block,
            children: result.updatedBlocks,
          };
        }

        if (block.type === "tryCatch") {
          const tryResult = removeBlockById(block.tryChildren, id);
          const catchResult = removeBlockById(block.catchChildren, id);

          if (tryResult.removedBlock) {
            removedBlock = tryResult.removedBlock;
          }

          if (catchResult.removedBlock) {
            removedBlock = catchResult.removedBlock;
          }

          return {
            ...block,
            tryChildren: tryResult.updatedBlocks,
            catchChildren: catchResult.updatedBlocks,
          };
        }

        return block;
      })
      .filter((block): block is Block => block !== null);

    return { updatedBlocks, removedBlock };
  }

  function blockContainsId(block: Block, id: number): boolean {
    if (block.id === id) {
      return true;
    }

    if (block.type === "if" || block.type === "while" || block.type === "for") {
      return block.children.some((child) => blockContainsId(child, id));
    }

    if (block.type === "tryCatch") {
      return (
        block.tryChildren.some((child) => blockContainsId(child, id)) ||
        block.catchChildren.some((child) => blockContainsId(child, id))
      );
    }

    return false;
  }

  function findBlockById(blockList: Block[], id: number): Block | null {
    for (const block of blockList) {
      if (block.id === id) {
        return block;
      }

      if (block.type === "if" || block.type === "while" || block.type === "for") {
        const found = findBlockById(block.children, id);
        if (found) return found;
      }

      if (block.type === "tryCatch") {
        const foundInTry = findBlockById(block.tryChildren, id);
        if (foundInTry) return foundInTry;

        const foundInCatch = findBlockById(block.catchChildren, id);
        if (foundInCatch) return foundInCatch;
      }
    }

    return null;
  }

  function handleTemplateDragStart(
    event: React.DragEvent<HTMLDivElement>,
    type: BlockType
  ) {
    event.dataTransfer.setData("source", "template");
    event.dataTransfer.setData("blockType", type);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleWorkspaceBlockDragStart(
    event: React.DragEvent<HTMLDivElement>,
    id: number
  ) {
    event.stopPropagation();
    event.dataTransfer.setData("source", "workspace");
    event.dataTransfer.setData("blockId", String(id));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent<HTMLElement>, target: DropTarget) {
    event.preventDefault();
    event.stopPropagation();

    const source = event.dataTransfer.getData("source");

    if (source === "template") {
      const blockType = event.dataTransfer.getData("blockType") as BlockType;

      if (blockType) {
        const newBlock = createBlock(blockType);
        setBlocks((prev) => insertIntoBlocks(prev, target, newBlock));
      }
    }

    if (source === "workspace") {
      const blockId = Number(event.dataTransfer.getData("blockId"));

      if (!Number.isNaN(blockId)) {
        const movingBlock = findBlockById(blocks, blockId);

        if (!movingBlock) {
          return;
        }

        if ("parentId" in target && blockContainsId(movingBlock, target.parentId)) {
          setActiveDropTarget(null);
          return;
        }

        const removeResult = removeBlockById(blocks, blockId);

        if (removeResult.removedBlock) {
          const updated = insertIntoBlocks(
            removeResult.updatedBlocks,
            target,
            removeResult.removedBlock
          );

          setBlocks(updated);
        }
      }
    }

    setActiveDropTarget(null);
  }

  function handleDropZoneDragOver(
    event: React.DragEvent<HTMLElement>,
    target: DropTarget
  ) {
    event.preventDefault();
    event.stopPropagation();
    setActiveDropTarget(getDropTargetKey(target));
  }

  function handleDragEnd() {
    setActiveDropTarget(null);
  }

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, createBlock(type)]);
  }

  function deleteBlock(id: number) {
    const result = removeBlockById(blocks, id);
    setBlocks(result.updatedBlocks);
  }

  function updateBlock(id: number, field: string, value: string) {
    function update(blockList: Block[]): Block[] {
      return blockList.map((block) => {
        if (block.id === id) {
          return {
            ...block,
            [field]: value,
          } as Block;
        }

        if (block.type === "if" || block.type === "while" || block.type === "for") {
          return {
            ...block,
            children: update(block.children),
          };
        }

        if (block.type === "tryCatch") {
          return {
            ...block,
            tryChildren: update(block.tryChildren),
            catchChildren: update(block.catchChildren),
          };
        }

        return block;
      });
    }

    setBlocks((prev) => update(prev));
  }

  function zoomIn() {
    setZoom((prev) => Math.min(prev + 0.1, 1.6));
  }

  function zoomOut() {
    setZoom((prev) => Math.max(prev - 0.1, 0.6));
  }

  function resetZoom() {
    setZoom(1);
  }

  async function checkFlow() {
    try {
      const response = await fetch("http://localhost:3000/check-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ blocks }),
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        setResult(`Server Error: ${data.error || "Something went wrong."}`);
        return;
      }
  
      if (data.status === "error" || data.error) {
        setResult(`Runtime Error: ${data.error || "Program could not run."}`);
        return;
      }
  
      if (Array.isArray(data.output) && data.output.length > 0) {
        setResult(data.output.join("\n"));
        return;
      }
  
      setResult("Program finished with no output.");
    } catch (error) {
      console.error(error);
      setResult("Connection Error: Could not connect to backend.");
    }
  }

  function renderPaletteBlock(label: string, type: BlockType, className: string) {
    return (
      <div
        className={`template-block ${className}`}
        draggable
        onDragStart={(event) => handleTemplateDragStart(event, type)}
        onDragEnd={handleDragEnd}
        onClick={() => addBlock(type)}
      >
        {label}
      </div>
    );
  }

  function renderDropZone(target: DropTarget) {
    const key = getDropTargetKey(target);

    return (
      <div
        className={`insert-drop-zone ${
          activeDropTarget === key ? "active-insert-zone" : ""
        }`}
        onDragOver={(event) => handleDropZoneDragOver(event, target)}
        onDrop={(event) => handleDrop(event, target)}
      >
        {activeDropTarget === key && <span>Drop here</span>}
      </div>
    );
  }

  function renderNestedArea(
    blockList: Block[],
    area: "children" | "tryChildren" | "catchChildren",
    parentId: number
  ) {
    const endTarget: DropTarget = {
      area,
      parentId,
      index: blockList.length,
    };

    return (
      <div
        className={`nested-area ${
          activeDropTarget === getDropTargetKey(endTarget)
            ? "active-nested-area"
            : ""
        }`}
        onDragOver={(event) => handleDropZoneDragOver(event, endTarget)}
        onDrop={(event) => handleDrop(event, endTarget)}
      >
        {blockList.length === 0 && (
          <div className="nested-placeholder">Drop blocks here</div>
        )}

        {renderBlockList(blockList, area, parentId)}
      </div>
    );
  }

  function renderBlockList(
    blockList: Block[],
    area: DropTarget["area"],
    parentId?: number
  ) {
    return (
      <>
        {renderDropZone(
          area === "root"
            ? { area: "root", index: 0 }
            : { area, parentId: parentId as number, index: 0 }
        )}

        {blockList.map((block, index) => (
          <div key={block.id} className="block-wrapper">
            {renderBlock(block)}

            {renderDropZone(
              area === "root"
                ? { area: "root", index: index + 1 }
                : {
                    area,
                    parentId: parentId as number,
                    index: index + 1,
                  }
            )}
          </div>
        ))}
      </>
    );
  }

  function isContainerBlock(block: Block) {
    return (
      block.type === "if" ||
      block.type === "while" ||
      block.type === "for" ||
      block.type === "tryCatch"
    );
  }

  function renderBlock(block: Block) {
    return (
      <div
        className={`scratch-block ${block.type}-block ${
          isContainerBlock(block) ? "container-block" : ""
        }`}
        draggable
        onDragStart={(event) => handleWorkspaceBlockDragStart(event, block.id)}
        onDragEnd={handleDragEnd}
      >
        <button className="delete-button" onClick={() => deleteBlock(block.id)}>
          ×
        </button>

        {block.type === "variable" && (
          <div className="block-row">
            <select
              value={block.dataType}
              onChange={(event) =>
                updateBlock(block.id, "dataType", event.target.value)
              }
            >
              <option value="int">int</option>
              <option value="float">float</option>
              <option value="bool">bool</option>
              <option value="string">string</option>
            </select>

            <input
              placeholder="name"
              value={block.name}
              style={{ width: getInputWidth(block.name) }}
              onChange={(event) => updateBlock(block.id, "name", event.target.value)}
            />

            <span>=</span>

            <input
              placeholder="value"
              value={block.value}
              style={{ width: getInputWidth(block.value) }}
              onChange={(event) =>
                updateBlock(block.id, "value", event.target.value)
              }
            />
          </div>
        )}

        {block.type === "calculation" && (
          <div className="block-row">
            <input
              placeholder="left"
              value={block.left}
              style={{ width: getInputWidth(block.left) }}
              onChange={(event) => updateBlock(block.id, "left", event.target.value)}
            />

            <select
              value={block.operator}
              onChange={(event) =>
                updateBlock(block.id, "operator", event.target.value)
              }
            >
              <option value="+">+</option>
              <option value="-">−</option>
              <option value="*">×</option>
              <option value="/">÷</option>
              <option value="%">%</option>
            </select>

            <input
              placeholder="right"
              value={block.right}
              style={{ width: getInputWidth(block.right) }}
              onChange={(event) =>
                updateBlock(block.id, "right", event.target.value)
              }
            />
          </div>
        )}

        {block.type === "logic" && (
          <div className="block-row">
            <input
              placeholder="left"
              value={block.left}
              style={{ width: getInputWidth(block.left) }}
              onChange={(event) => updateBlock(block.id, "left", event.target.value)}
            />

            <select
              value={block.operator}
              onChange={(event) =>
                updateBlock(block.id, "operator", event.target.value)
              }
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="and">and</option>
              <option value="or">or</option>
            </select>

            <input
              placeholder="right"
              value={block.right}
              style={{ width: getInputWidth(block.right) }}
              onChange={(event) =>
                updateBlock(block.id, "right", event.target.value)
              }
            />
          </div>
        )}

        {block.type === "print" && (
          <div className="block-row">
            <span>print</span>
            <input
              placeholder="value"
              value={block.value}
              style={{ width: getInputWidth(block.value) }}
              onChange={(event) =>
                updateBlock(block.id, "value", event.target.value)
              }
            />
          </div>
        )}

        {block.type === "if" && (
          <>
            <div className="block-row">
              <span>if</span>
              <input
                className="condition-input"
                placeholder="condition"
                value={block.condition}
                style={{ width: getInputWidth(block.condition, 150, 340) }}
                onChange={(event) =>
                  updateBlock(block.id, "condition", event.target.value)
                }
              />
            </div>

            {renderNestedArea(block.children, "children", block.id)}
          </>
        )}

        {block.type === "while" && (
          <>
            <div className="block-row">
              <span>while</span>
              <input
                className="condition-input"
                placeholder="condition"
                value={block.condition}
                style={{ width: getInputWidth(block.condition, 150, 340) }}
                onChange={(event) =>
                  updateBlock(block.id, "condition", event.target.value)
                }
              />
            </div>

            {renderNestedArea(block.children, "children", block.id)}
          </>
        )}

        {block.type === "for" && (
          <>
            <div className="block-row">
              <span>for</span>
              <input
                placeholder="i"
                value={block.variable}
                style={{ width: getInputWidth(block.variable) }}
                onChange={(event) =>
                  updateBlock(block.id, "variable", event.target.value)
                }
              />
              <span>from</span>
              <input
                placeholder="0"
                value={block.start}
                style={{ width: getInputWidth(block.start) }}
                onChange={(event) =>
                  updateBlock(block.id, "start", event.target.value)
                }
              />
              <span>to</span>
              <input
                placeholder="10"
                value={block.end}
                style={{ width: getInputWidth(block.end) }}
                onChange={(event) =>
                  updateBlock(block.id, "end", event.target.value)
                }
              />
            </div>

            {renderNestedArea(block.children, "children", block.id)}
          </>
        )}

        {block.type === "tryCatch" && (
          <>
            <div className="block-row">
              <span>try</span>
            </div>

            {renderNestedArea(block.tryChildren, "tryChildren", block.id)}

            <div className="catch-row">
              <span>catch</span>
              <input
                placeholder="error"
                value={block.catchErrorName}
                style={{ width: getInputWidth(block.catchErrorName) }}
                onChange={(event) =>
                  updateBlock(block.id, "catchErrorName", event.target.value)
                }
              />
            </div>

            {renderNestedArea(block.catchChildren, "catchChildren", block.id)}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="block-menu">
        <h1>Blocks</h1>

        <section className="block-section">
          <h3>Variables</h3>
          {renderPaletteBlock("variable", "variable", "variable-template")}
        </section>

        <section className="block-section">
          <h3>Operations</h3>
          {renderPaletteBlock(
            "calculation",
            "calculation",
            "calculation-template"
          )}
          {renderPaletteBlock("logic", "logic", "logic-template")}
        </section>

        <section className="block-section">
          <h3>Control Flow</h3>
          {renderPaletteBlock("if", "if", "control-template")}
          {renderPaletteBlock("for", "for", "control-template")}
          {renderPaletteBlock("while", "while", "control-template")}
        </section>

        <section className="block-section">
          <h3>Error Handling</h3>
          {renderPaletteBlock("try/catch", "tryCatch", "try-template")}
        </section>

        <section className="block-section">
          <h3>Output</h3>
          {renderPaletteBlock("print", "print", "print-template")}
        </section>
      </aside>

      <main className="workspace-area">
        <div className="workspace-toolbar">
          <div>
            <h2>Workspace</h2>
            <p>Drop blocks into the main area or inside container blocks.</p>
          </div>

          <div className="zoom-controls">
            <button onClick={zoomOut}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn}>+</button>
            <button onClick={resetZoom}>Reset</button>
          </div>
        </div>

        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) =>
            handleDrop(event, {
              area: "root",
              index: blocks.length,
            })
          }
        >
          {blocks.length === 0 && (
            <div className="empty-message">Drag a block here</div>
          )}

          <div
            className="zoom-canvas"
            style={{
              transform: `scale(${zoom})`,
            }}
          >
            {renderBlockList(blocks, "root")}
          </div>
        </div>
      </main>

      <aside className="output-panel">
        <h2>Output</h2>
        
        <button className="run-button" onClick={checkFlow}>
          <svg
            className="run-icon"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <path d="M8 5V19L19 12L8 5Z" />
          </svg>
          <span>Run</span>
        </button>

        {result && <p className="result-message">{result}</p>}

        <h3>JSON</h3>
        <pre>{JSON.stringify({ blocks }, null, 2)}</pre>
      </aside>
    </div>
  );
}

export default App;
