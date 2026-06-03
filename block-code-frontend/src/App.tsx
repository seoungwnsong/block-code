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
    };

type BlockType = Block["type"];

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [result, setResult] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);

  function createBlock(type: BlockType): Block {
    const id = Date.now() + Math.floor(Math.random() * 1000);

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

    return {
      id,
      type: "logic",
      left: "",
      operator: "==",
      right: "",
    };
  }

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, createBlock(type)]);
  }

  function insertBlockAtIndex(newBlock: Block, index: number) {
    setBlocks((prev) => {
      const updated = [...prev];
      updated.splice(index, 0, newBlock);
      return updated;
    });
  }

  function moveBlockToIndex(blockId: number, targetIndex: number) {
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((block) => block.id === blockId);

      if (oldIndex === -1) {
        return prev;
      }

      const movingBlock = prev[oldIndex];
      const withoutMovingBlock = prev.filter((block) => block.id !== blockId);

      let adjustedIndex = targetIndex;

      if (oldIndex < targetIndex) {
        adjustedIndex = targetIndex - 1;
      }

      const updated = [...withoutMovingBlock];
      updated.splice(adjustedIndex, 0, movingBlock);

      return updated;
    });
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
    event.dataTransfer.setData("source", "workspace");
    event.dataTransfer.setData("blockId", String(id));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDropAtIndex(
    event: React.DragEvent<HTMLElement>,
    index: number
  ) {
    event.preventDefault();
    event.stopPropagation();

    const source = event.dataTransfer.getData("source");

    if (source === "template") {
      const blockType = event.dataTransfer.getData("blockType") as BlockType;

      if (blockType) {
        insertBlockAtIndex(createBlock(blockType), index);
      }
    }

    if (source === "workspace") {
      const blockId = Number(event.dataTransfer.getData("blockId"));

      if (!Number.isNaN(blockId)) {
        moveBlockToIndex(blockId, index);
      }
    }

    setActiveDropIndex(null);
  }

  function handleDropAtEnd(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const index = activeDropIndex ?? blocks.length;
    handleDropAtIndex(event, index);
  }

  function handleBlockDragOver(
    event: React.DragEvent<HTMLDivElement>,
    index: number
  ) {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseY = event.clientY;
    const middleY = rect.top + rect.height / 2;

    if (mouseY < middleY) {
      setActiveDropIndex(index);
    } else {
      setActiveDropIndex(index + 1);
    }
  }

  function handleWorkspaceDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (blocks.length === 0) {
      setActiveDropIndex(0);
    }
  }

  function handleDragEnd() {
    setActiveDropIndex(null);
  }

  function deleteBlock(id: number) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function updateBlock(id: number, field: string, value: string) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id ? ({ ...block, [field]: value } as Block) : block
      )
    );
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

      setResult(
        `Backend received ${data.blockCount} block(s). Status: ${data.status}`
      );
    } catch (error) {
      console.error(error);
      setResult("Error: Could not connect to backend.");
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

  function renderDropZone(index: number) {
    return (
      <div
        className={`insert-drop-zone ${
          activeDropIndex === index ? "active-insert-zone" : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setActiveDropIndex(index);
        }}
        onDrop={(event) => handleDropAtIndex(event, index)}
      >
        {activeDropIndex === index && <span>Drop here</span>}
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

        <p className="hint-text">Drag into a gap, or click to add.</p>
      </aside>

      <main className="workspace-area">
        <div className="workspace-toolbar">
          <div>
            <h2>Workspace</h2>
            <p>Drop blocks between other blocks to insert them.</p>
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
          onDragOver={handleWorkspaceDragOver}
          onDrop={handleDropAtEnd}
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
            {renderDropZone(0)}

            {blocks.map((block, index) => (
              <div
                key={block.id}
                className="block-wrapper"
                onDragOver={(event) => handleBlockDragOver(event, index)}
                onDrop={(event) =>
                  handleDropAtIndex(event, activeDropIndex ?? index + 1)
                }
              >
                <div
                  className={`scratch-block ${block.type}-block`}
                  draggable
                  onDragStart={(event) =>
                    handleWorkspaceBlockDragStart(event, block.id)
                  }
                  onDragEnd={handleDragEnd}
                >
                  <button
                    className="delete-button"
                    onClick={() => deleteBlock(block.id)}
                  >
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
                        onChange={(event) =>
                          updateBlock(block.id, "name", event.target.value)
                        }
                      />

                      <span>=</span>

                      <input
                        placeholder="value"
                        value={block.value}
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
                        onChange={(event) =>
                          updateBlock(block.id, "left", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateBlock(block.id, "left", event.target.value)
                        }
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
                        onChange={(event) =>
                          updateBlock(block.id, "right", event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>

                {renderDropZone(index + 1)}
              </div>
            ))}
          </div>
        </div>
      </main>

      <aside className="output-panel">
        <h2>Output</h2>

        <button className="check-button" onClick={checkFlow}>
          Check Flow
        </button>

        {result && <p className="result-message">{result}</p>}

        <h3>JSON</h3>
        <pre>{JSON.stringify({ blocks }, null, 2)}</pre>
      </aside>
    </div>
  );
}

export default App;
