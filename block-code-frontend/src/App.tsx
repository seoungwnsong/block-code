import { useState } from "react";
import "./App.css";


// Represents one block in our visual programming interface. 
// It can be either an assignment or a calculation. 
// >> Can be extended in the future to include more block types.
type Block =
  | {
      id: number;
      type: "assignment";
      variable: string;
      value: string;
    }
  | {
      id: number;
      type: "calculation";
      variable: string;
      left: string;
      operator: "+" | "-" | "*" | "/";
      right: string;
    };


function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [result, setResult] = useState<string>("");

  // These functions add new blocks to the back of the workspace with.
  // default values that can be edited by the user.
  function addAssignmentBlock() {
    const newBlock: Block = {
      id: Date.now(),
      type: "assignment",
      variable: "x",
      value: "3",
    };
    setBlocks([...blocks, newBlock]);
  }

  function addCalculationBlock() {
    const newBlock: Block = {
      id: Date.now(),
      type: "calculation",
      variable: "y",
      left: "x",
      operator: "+",
      right: "2",
    };
    setBlocks([...blocks, newBlock]);
  }

  
  // Updates a specific field of a block based on its ID.
  // @param id - The unique identifier of the block to be updated.
  // @param field - The specific field of the block to be updated (e.g., "variable", "value", "left", "operator", "right").
  // @param value - The new value to be assigned to the specified field.
  function updateBlock(id: number, field: string, value: string) {
    const updatedBlocks = blocks.map((block) => {
      if (block.id !== id) {
        return block;
      }

      return {
        ...block,
        [field]: value,
      };
    });

    setBlocks(updatedBlocks as Block[]);
  }

  // This function removes a block from the workspace based on its ID.
  // @param id - The unique identifier of the block to be deleted.
  function deleteBlock(id: number) {
    const updatedBlocks = blocks.filter((block) => block.id !== id);
    setBlocks(updatedBlocks);
  }

  // This function is a placeholder for the backend integration 
  // that will check the flow of the blocks.
  function checkFlow() {
  console.log("Sending this data to backend:", { blocks });
  setResult("Flow checked! Later this button will send data to backend.");
}
  return (
    <div className="app">
      <aside className="block-menu">
        <h2>Blocks</h2>
        <button onClick={addAssignmentBlock}>Add Assignment</button>
        <button onClick={addCalculationBlock}>Add Calculation</button>
      </aside>

      <main className="workspace">
        <h2>Workspace</h2>

        {blocks.length === 0 && <p>No blocks yet. Add one from the left.</p>}

        {blocks.map((block) => (
          <div className="block" key={block.id}>

            <button className="delete-button" onClick={() => deleteBlock(block.id)}>
              Delete
            </button>

            {block.type === "assignment" ? (
              <>
                <strong>Assignment</strong>
                <div className="block-row">
                  <input
                    value={block.variable}
                    onChange={(event) =>
                      updateBlock(block.id, "variable", event.target.value)
                    }
                  />
                  <span>=</span>
                  <input
                    value={block.value}
                    onChange={(event) =>
                      updateBlock(block.id, "value", event.target.value)
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <strong>Calculation</strong>
                <div className="block-row">
                  <input
                    value={block.variable}
                    onChange={(event) =>
                      updateBlock(block.id, "variable", event.target.value)
                    }
                  />
                  <span>=</span>
                  <input
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
                    <option value="-">-</option>
                    <option value="*">*</option>
                    <option value="/">/</option>
                  </select>
                  <input
                    value={block.right}
                    onChange={(event) =>
                      updateBlock(block.id, "right", event.target.value)
                    }
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </main>
      <aside className="output-panel">
        <h2>JSON Output</h2>
        <button onClick={checkFlow}>Check Flow</button>
        {result && <p>{result}</p>}
        <pre>{JSON.stringify({ blocks }, null, 2)}</pre>
      </aside>
    </div>
  );
}

export default App;