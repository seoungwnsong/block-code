import { useState } from "react";
import "./App.css";

type DataType = "int" | "float" | "bool" | "string";
type MathOperator = "+" | "-" | "*" | "/" | "%";
type LogicOperator = "==" | "!=" | ">" | "<" | ">=" | "<=" | "and" | "or";

type ExpressionBlock =
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
      type: "call";
      functionId: number;
      name: string;
      paramNames: string[];
      args: string[];
    };

type ReturnValue = string | ExpressionBlock;

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
      type: "return";
      value: ReturnValue;
    }
  | {
      id: number;
      type: "call";
      functionId: number;
      name: string;
      paramNames: string[];
      args: string[];
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

type UserFunction = {
  id: number;
  name: string;
  params: string[];
  children: Block[];
};

type BlockType = Block["type"];

type ListDropTarget =
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

type ReturnDropTarget = {
  area: "returnValue";
  parentId: number;
};

type DropTarget = ListDropTarget | ReturnDropTarget;
type ListArea = ListDropTarget["area"];

function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [result, setResult] = useState("");
  const [zoom, setZoom] = useState(1);
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);
  const [currentDropTarget, setCurrentDropTarget] =
    useState<DropTarget | null>(null);

  const [functions, setFunctions] = useState<UserFunction[]>([]);
  const [editingFunctionId, setEditingFunctionId] = useState<number | null>(
    null
  );
  const [openFunctionMenuId, setOpenFunctionMenuId] = useState<number | null>(
    null
  );
  const [functionToDeleteId, setFunctionToDeleteId] = useState<number | null>(
    null
  );
  const [openFunctionTabIds, setOpenFunctionTabIds] = useState<number[]>([]);

  const editingFunction =
    editingFunctionId === null
      ? null
      : functions.find((func) => func.id === editingFunctionId) ?? null;

  const currentBlocks = editingFunction ? editingFunction.children : blocks;

  function makeId() {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  function getInputWidth(value: string, minWidth = 72, maxWidth = 240) {
    const textLength = value.length === 0 ? 4 : value.length;
    const calculatedWidth = textLength * 8 + 18;
    return Math.min(Math.max(minWidth, calculatedWidth), maxWidth);
  }

  function setCurrentBlocks(updater: Block[] | ((prev: Block[]) => Block[])) {
    if (editingFunction) {
      setFunctions((prev) =>
        prev.map((func) => {
          if (func.id !== editingFunction.id) return func;

          const nextChildren =
            typeof updater === "function" ? updater(func.children) : updater;

          return {
            ...func,
            children: nextChildren,
          };
        })
      );

      return;
    }

    setBlocks(updater);
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

    if (type === "return") {
      return {
        id,
        type: "return",
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

    if (type === "tryCatch") {
      return {
        id,
        type: "tryCatch",
        catchErrorName: "error",
        tryChildren: [],
        catchChildren: [],
      };
    }

    return {
      id,
      type: "call",
      functionId: -1,
      name: "function",
      paramNames: [],
      args: [],
    };
  }

  function getDropTargetKey(target: DropTarget) {
    if (target.area === "root") {
      return `root-${target.index}`;
    }

    if (target.area === "returnValue") {
      return `returnValue-${target.parentId}`;
    }

    return `${target.area}-${target.parentId}-${target.index}`;
  }

  function isExpressionBlock(value: ReturnValue): value is ExpressionBlock {
    return (
      typeof value !== "string" &&
      (value.type === "calculation" ||
        value.type === "logic" ||
        value.type === "call")
    );
  }

  function canUseAsReturnValue(block: Block): block is ExpressionBlock {
    return (
      block.type === "calculation" ||
      block.type === "logic" ||
      block.type === "call"
    );
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
      if (
        target.area === "returnValue" &&
        block.id === target.parentId &&
        block.type === "return" &&
        canUseAsReturnValue(newBlock)
      ) {
        return {
          ...block,
          value: newBlock,
        };
      }

      if (target.area !== "returnValue" && block.id === target.parentId) {
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

      if (
        block.type === "if" ||
        block.type === "while" ||
        block.type === "for"
      ) {
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

        if (
          block.type === "return" &&
          isExpressionBlock(block.value) &&
          block.value.id === id
        ) {
          removedBlock = block.value as Block;

          return {
            ...block,
            value: "",
          };
        }

        if (
          block.type === "if" ||
          block.type === "while" ||
          block.type === "for"
        ) {
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

      if (
        block.type === "return" &&
        isExpressionBlock(block.value) &&
        block.value.id === id
      ) {
        return block.value as Block;
      }

      if (
        block.type === "if" ||
        block.type === "while" ||
        block.type === "for"
      ) {
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

  function findBlockLocation(
    blockList: Block[],
    id: number,
    area: ListArea = "root",
    parentId?: number
  ): ListDropTarget | null {
    for (let index = 0; index < blockList.length; index++) {
      const block = blockList[index];

      if (block.id === id) {
        if (area === "root") {
          return {
            area: "root",
            index,
          };
        }

        return {
          area,
          parentId: parentId as number,
          index,
        };
      }

      if (
        block.type === "if" ||
        block.type === "while" ||
        block.type === "for"
      ) {
        const found = findBlockLocation(
          block.children,
          id,
          "children",
          block.id
        );

        if (found) return found;
      }

      if (block.type === "tryCatch") {
        const foundInTry = findBlockLocation(
          block.tryChildren,
          id,
          "tryChildren",
          block.id
        );

        if (foundInTry) return foundInTry;

        const foundInCatch = findBlockLocation(
          block.catchChildren,
          id,
          "catchChildren",
          block.id
        );

        if (foundInCatch) return foundInCatch;
      }
    }

    return null;
  }

  function isSameListTarget(source: ListDropTarget, target: DropTarget) {
    if (target.area === "returnValue") {
      return false;
    }

    if (source.area !== target.area) {
      return false;
    }

    if (source.area === "root" && target.area === "root") {
      return true;
    }

    if ("parentId" in source && "parentId" in target) {
      return source.parentId === target.parentId;
    }

    return false;
  }

  function adjustTargetAfterRemoval(
    blockList: Block[],
    blockId: number,
    target: DropTarget
  ): DropTarget {
    if (target.area === "returnValue") {
      return target;
    }

    const sourceLocation = findBlockLocation(blockList, blockId);

    if (
      sourceLocation &&
      isSameListTarget(sourceLocation, target) &&
      sourceLocation.index < target.index
    ) {
      return {
        ...target,
        index: target.index - 1,
      };
    }

    return target;
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

    const finalTarget = currentDropTarget ?? target;
    const source = event.dataTransfer.getData("source");

    if (source === "template") {
      const blockType = event.dataTransfer.getData("blockType") as BlockType;

      if (blockType) {
        const newBlock = createBlock(blockType);
        setCurrentBlocks((prev) => insertIntoBlocks(prev, finalTarget, newBlock));
      }
    }

    if (source === "function") {
      const functionId = Number(event.dataTransfer.getData("functionId"));
      const func = functions.find((item) => item.id === functionId);

      if (func) {
        const newBlock = createCallBlock(func);
        setCurrentBlocks((prev) => insertIntoBlocks(prev, finalTarget, newBlock));
      }
    }

    if (source === "workspace") {
      const blockId = Number(event.dataTransfer.getData("blockId"));

      if (!Number.isNaN(blockId)) {
        setCurrentBlocks((prev) => {
          const movingBlock = findBlockById(prev, blockId);

          if (!movingBlock) {
            return prev;
          }

          if (
            finalTarget.area === "returnValue" &&
            !canUseAsReturnValue(movingBlock)
          ) {
            return prev;
          }

          if (
            "parentId" in finalTarget &&
            blockContainsId(movingBlock, finalTarget.parentId)
          ) {
            return prev;
          }

          const adjustedTarget = adjustTargetAfterRemoval(
            prev,
            blockId,
            finalTarget
          );

          const removeResult = removeBlockById(prev, blockId);

          if (!removeResult.removedBlock) {
            return prev;
          }

          return insertIntoBlocks(
            removeResult.updatedBlocks,
            adjustedTarget,
            removeResult.removedBlock
          );
        });
      }
    }

    setActiveDropTarget(null);
    setCurrentDropTarget(null);
  }

  function handleDropZoneDragOver(
    event: React.DragEvent<HTMLElement>,
    target: DropTarget
  ) {
    event.preventDefault();
    event.stopPropagation();

    setActiveDropTarget(getDropTargetKey(target));
    setCurrentDropTarget(target);
  }

  function handleDragEnd() {
    setActiveDropTarget(null);
    setCurrentDropTarget(null);
  }

  function addBlock(type: BlockType) {
    setCurrentBlocks((prev) => [...prev, createBlock(type)]);
  }

  function deleteBlock(id: number) {
    const result = removeBlockById(currentBlocks, id);
    setCurrentBlocks(result.updatedBlocks);
  }

  function updateBlock(
    id: number,
    field: string,
    value: string | string[] | ReturnValue
  ) {
    function update(blockList: Block[]): Block[] {
      return blockList.map((block) => {
        if (block.id === id) {
          return {
            ...block,
            [field]: value,
          } as Block;
        }

        if (
          block.type === "return" &&
          isExpressionBlock(block.value) &&
          block.value.id === id
        ) {
          return {
            ...block,
            value: {
              ...block.value,
              [field]: value,
            } as ExpressionBlock,
          };
        }

        if (
          block.type === "if" ||
          block.type === "while" ||
          block.type === "for"
        ) {
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

    setCurrentBlocks((prev) => update(prev));
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

  function createFunction() {
    const newFunction: UserFunction = {
      id: makeId(),
      name: `myFunction${functions.length + 1}`,
      params: [],
      children: [],
    };

    setFunctions((prev) => [...prev, newFunction]);
    setOpenFunctionTabIds((prev) => [...prev, newFunction.id]);
    setEditingFunctionId(newFunction.id);
  }

  function openFunctionTab(id: number) {
    setOpenFunctionTabIds((prev) =>
      prev.includes(id) ? prev : [...prev, id]
    );
    setEditingFunctionId(id);
    setOpenFunctionMenuId(null);
  }

  function closeFunctionTab(id: number) {
    setOpenFunctionTabIds((prev) => prev.filter((tabId) => tabId !== id));

    if (editingFunctionId === id) {
      setEditingFunctionId(null);
    }
  }

  function requestDeleteFunction(id: number) {
    setFunctionToDeleteId(id);
    setOpenFunctionMenuId(null);
  }

  function cancelDeleteFunction() {
    setFunctionToDeleteId(null);
  }

  function confirmDeleteFunction() {
    if (functionToDeleteId === null) return;

    deleteFunction(functionToDeleteId);
    setFunctionToDeleteId(null);
  }

  function syncExpressionFunctionCalls(
    value: ReturnValue,
    functionId: number,
    nextName: string,
    nextParams: string[]
  ): ReturnValue {
    if (!isExpressionBlock(value)) {
      return value;
    }

    if (value.type === "call" && value.functionId === functionId) {
      const nextArgs = nextParams.map((_, index) => value.args[index] ?? "");

      return {
        ...value,
        name: nextName,
        paramNames: nextParams,
        args: nextArgs,
      };
    }

    return value;
  }

  function syncFunctionCalls(
    blockList: Block[],
    functionId: number,
    nextName: string,
    nextParams: string[]
  ): Block[] {
    return blockList.map((block) => {
      if (block.type === "call" && block.functionId === functionId) {
        const nextArgs = nextParams.map((_, index) => block.args[index] ?? "");

        return {
          ...block,
          name: nextName,
          paramNames: nextParams,
          args: nextArgs,
        };
      }

      if (block.type === "return") {
        return {
          ...block,
          value: syncExpressionFunctionCalls(
            block.value,
            functionId,
            nextName,
            nextParams
          ),
        };
      }

      if (
        block.type === "if" ||
        block.type === "while" ||
        block.type === "for"
      ) {
        return {
          ...block,
          children: syncFunctionCalls(
            block.children,
            functionId,
            nextName,
            nextParams
          ),
        };
      }

      if (block.type === "tryCatch") {
        return {
          ...block,
          tryChildren: syncFunctionCalls(
            block.tryChildren,
            functionId,
            nextName,
            nextParams
          ),
          catchChildren: syncFunctionCalls(
            block.catchChildren,
            functionId,
            nextName,
            nextParams
          ),
        };
      }

      return block;
    });
  }

  function updateFunctionName(id: number, name: string) {
    const currentFunction = functions.find((func) => func.id === id);
    const currentParams = currentFunction?.params ?? [];

    setFunctions((prev) =>
      prev.map((func) => {
        const updatedFunc = func.id === id ? { ...func, name } : func;

        return {
          ...updatedFunc,
          children: syncFunctionCalls(
            updatedFunc.children,
            id,
            name,
            currentParams
          ),
        };
      })
    );

    setBlocks((prev) => syncFunctionCalls(prev, id, name, currentParams));
  }

  function addParameter(id: number) {
    const currentFunction = functions.find((func) => func.id === id);
    if (!currentFunction) return;

    const nextParams = [...currentFunction.params, ""];

    setFunctions((prev) =>
      prev.map((func) => {
        const updatedFunc =
          func.id === id ? { ...func, params: nextParams } : func;

        return {
          ...updatedFunc,
          children: syncFunctionCalls(
            updatedFunc.children,
            id,
            currentFunction.name,
            nextParams
          ),
        };
      })
    );

    setBlocks((prev) =>
      syncFunctionCalls(prev, id, currentFunction.name, nextParams)
    );
  }

  function updateParameter(id: number, index: number, value: string) {
    const currentFunction = functions.find((func) => func.id === id);
    if (!currentFunction) return;

    const nextParams = [...currentFunction.params];
    nextParams[index] = value;

    setFunctions((prev) =>
      prev.map((func) => {
        const updatedFunc =
          func.id === id ? { ...func, params: nextParams } : func;

        return {
          ...updatedFunc,
          children: syncFunctionCalls(
            updatedFunc.children,
            id,
            currentFunction.name,
            nextParams
          ),
        };
      })
    );

    setBlocks((prev) =>
      syncFunctionCalls(prev, id, currentFunction.name, nextParams)
    );
  }

  function deleteParameter(id: number, index: number) {
    const currentFunction = functions.find((func) => func.id === id);
    if (!currentFunction) return;

    const nextParams = currentFunction.params.filter(
      (_, paramIndex) => paramIndex !== index
    );

    setFunctions((prev) =>
      prev.map((func) => {
        const updatedFunc =
          func.id === id ? { ...func, params: nextParams } : func;

        return {
          ...updatedFunc,
          children: syncFunctionCalls(
            updatedFunc.children,
            id,
            currentFunction.name,
            nextParams
          ),
        };
      })
    );

    setBlocks((prev) =>
      syncFunctionCalls(prev, id, currentFunction.name, nextParams)
    );
  }

  function createCallBlock(func: UserFunction): Block {
    return {
      id: makeId(),
      type: "call",
      functionId: func.id,
      name: func.name,
      paramNames: func.params,
      args: func.params.map(() => ""),
    };
  }

  function removeFunctionCallsFromReturnValue(
    value: ReturnValue,
    functionId: number
  ): ReturnValue {
    if (
      isExpressionBlock(value) &&
      value.type === "call" &&
      value.functionId === functionId
    ) {
      return "";
    }

    return value;
  }

  function removeFunctionCalls(blockList: Block[], functionId: number): Block[] {
    return blockList
      .filter(
        (block) => !(block.type === "call" && block.functionId === functionId)
      )
      .map((block) => {
        if (block.type === "return") {
          return {
            ...block,
            value: removeFunctionCallsFromReturnValue(
              block.value,
              functionId
            ),
          };
        }

        if (
          block.type === "if" ||
          block.type === "while" ||
          block.type === "for"
        ) {
          return {
            ...block,
            children: removeFunctionCalls(block.children, functionId),
          };
        }

        if (block.type === "tryCatch") {
          return {
            ...block,
            tryChildren: removeFunctionCalls(block.tryChildren, functionId),
            catchChildren: removeFunctionCalls(block.catchChildren, functionId),
          };
        }

        return block;
      });
  }

  function deleteFunction(id: number) {
    setFunctions((prev) =>
      prev
        .filter((func) => func.id !== id)
        .map((func) => ({
          ...func,
          children: removeFunctionCalls(func.children, id),
        }))
    );

    setOpenFunctionTabIds((prev) => prev.filter((tabId) => tabId !== id));

    if (editingFunctionId === id) {
      setEditingFunctionId(null);
    }

    setBlocks((prev) => removeFunctionCalls(prev, id));
  }

  function addFunctionCall(func: UserFunction) {
    setCurrentBlocks((prev) => [...prev, createCallBlock(func)]);
  }

  async function checkFlow() {
    try {
      const response = await fetch("http://localhost:3000/check-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          functions: functions.map((func) => ({
            id: func.id,
            type: "def",
            name: func.name,
            params: func.params,
            children: func.children,
          })),
          blocks,
        }),
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

  function getBlockHoverTarget(
    event: React.DragEvent<HTMLDivElement>,
    area: ListArea,
    index: number,
    parentId?: number
  ): ListDropTarget {
    const rect = event.currentTarget.getBoundingClientRect();
    const mouseY = event.clientY;
    const isTopHalf = mouseY < rect.top + rect.height / 2;

    const targetIndex = isTopHalf ? index : index + 1;

    if (area === "root") {
      return {
        area: "root",
        index: targetIndex,
      };
    }

    return {
      area,
      parentId: parentId as number,
      index: targetIndex,
    };
  }

  function renderBlockList(
    blockList: Block[],
    area: ListArea,
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
          <div
            key={block.id}
            className="block-wrapper"
            onDragOver={(event) => {
              const target = getBlockHoverTarget(event, area, index, parentId);
              handleDropZoneDragOver(event, target);
            }}
            onDrop={(event) => {
              const target = getBlockHoverTarget(event, area, index, parentId);
              handleDrop(event, target);
            }}
          >
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

  function renderExpressionBlock(expression: ExpressionBlock) {
    if (expression.type === "calculation") {
      return (
        <div className="return-expression-block calculation-block">
          <input
            placeholder="left"
            value={expression.left}
            style={{ width: getInputWidth(expression.left) }}
            onChange={(event) =>
              updateBlock(expression.id, "left", event.target.value)
            }
          />

          <select
            value={expression.operator}
            onChange={(event) =>
              updateBlock(expression.id, "operator", event.target.value)
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
            value={expression.right}
            style={{ width: getInputWidth(expression.right) }}
            onChange={(event) =>
              updateBlock(expression.id, "right", event.target.value)
            }
          />
        </div>
      );
    }

    if (expression.type === "logic") {
      return (
        <div className="return-expression-block logic-block">
          <input
            placeholder="left"
            value={expression.left}
            style={{ width: getInputWidth(expression.left) }}
            onChange={(event) =>
              updateBlock(expression.id, "left", event.target.value)
            }
          />

          <select
            value={expression.operator}
            onChange={(event) =>
              updateBlock(expression.id, "operator", event.target.value)
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
            value={expression.right}
            style={{ width: getInputWidth(expression.right) }}
            onChange={(event) =>
              updateBlock(expression.id, "right", event.target.value)
            }
          />
        </div>
      );
    }

    return (
      <div className="return-expression-block call-block">
        <span>{expression.name}</span>
        <span>(</span>

        {expression.args.map((arg, index) => (
          <input
            key={index}
            className="function-arg-hole"
            placeholder={expression.paramNames[index] || `arg ${index + 1}`}
            value={arg}
            style={{ width: getInputWidth(arg, 72, 160) }}
            onChange={(event) => {
              const newArgs = [...expression.args];
              newArgs[index] = event.target.value;
              updateBlock(expression.id, "args", newArgs);
            }}
          />
        ))}

        <span>)</span>
      </div>
    );
  }

  function renderReturnValue(block: Extract<Block, { type: "return" }>) {
    const target: DropTarget = {
      area: "returnValue",
      parentId: block.id,
    };

    const key = getDropTargetKey(target);

    return (
      <div
        className={`return-value-slot ${
          activeDropTarget === key ? "active-return-value-slot" : ""
        }`}
        onDragOver={(event) => handleDropZoneDragOver(event, target)}
        onDrop={(event) => handleDrop(event, target)}
      >
        {typeof block.value === "string" ? (
          <input
            className="return-value-input"
            placeholder="type value or drop block"
            value={block.value}
            onChange={(event) =>
              updateBlock(block.id, "value", event.target.value)
            }
          />
        ) : (
          <>
            {renderExpressionBlock(block.value)}

            <button
              className="clear-return-value-button"
              onClick={() => updateBlock(block.id, "value", "")}
            >
              ×
            </button>
          </>
        )}
      </div>
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
              onChange={(event) =>
                updateBlock(block.id, "name", event.target.value)
              }
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

        {block.type === "return" && (
          <div className="block-row">
            <span>return</span>
            {renderReturnValue(block)}
          </div>
        )}

        {block.type === "call" && (
          <div className="block-row function-call-row">
            <span>{block.name}</span>
            <span>(</span>

            {block.args.map((arg, index) => (
              <input
                key={index}
                className="function-arg-hole"
                placeholder={block.paramNames[index] || `arg ${index + 1}`}
                value={arg}
                style={{ width: getInputWidth(arg, 72, 160) }}
                onChange={(event) => {
                  const newArgs = [...block.args];
                  newArgs[index] = event.target.value;
                  updateBlock(block.id, "args", newArgs);
                }}
              />
            ))}

            <span>)</span>
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
    <div className="app" onClick={() => setOpenFunctionMenuId(null)}>
      <aside className="function-sidebar app-font">
        <div className="sidebar-header">
          <h1>Functions</h1>
          <span>Custom blocks</span>
        </div>

        <button className="create-function-button" onClick={createFunction}>
          + Create Function
        </button>

        {functions.length === 0 && (
          <p className="empty-function-message">
            Create a function to make your own reusable block.
          </p>
        )}

        {functions.map((func) => (
          <div
            key={func.id}
            className={`function-library-item ${
              openFunctionMenuId === func.id ? "menu-open" : ""
            }`}
          >
            <div
              className="template-block function-template function-library-block"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("source", "function");
                event.dataTransfer.setData("functionId", String(func.id));
                event.dataTransfer.effectAllowed = "copy";
              }}
              onDragEnd={handleDragEnd}
              onClick={() => addFunctionCall(func)}
            >
              <span className="function-block-name">{func.name}</span>

              <button
                className="function-more-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenFunctionMenuId((prev) =>
                    prev === func.id ? null : func.id
                  );
                }}
                title="Function options"
              >
                ⋯
              </button>

              {openFunctionMenuId === func.id && (
                <div
                  className="function-menu"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openFunctionTab(func.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 20H8L18.5 9.5L14.5 5.5L4 16V20Z" />
                      <path d="M13.5 6.5L17.5 10.5" />
                    </svg>
                    <span>Edit</span>
                  </button>

                  <button
                    className="danger-menu-item"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDeleteFunction(func.id);
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 7H19" />
                      <path d="M10 11V17" />
                      <path d="M14 11V17" />
                      <path d="M8 7L9 4H15L16 7" />
                      <path d="M7 7L8 20H16L17 7" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </aside>

      <aside className="block-menu app-font">
        <div className="sidebar-header">
          <h1>Blocks</h1>
          <span>Drag or click</span>
        </div>

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
          {renderPaletteBlock("return", "return", "return-template")}
        </section>
      </aside>

      <main className="workspace-area">
        <div className="workspace-tabs app-font">
          <button
            className={`workspace-tab ${
              editingFunction ? "" : "active-workspace-tab"
            }`}
            onClick={() => setEditingFunctionId(null)}
          >
            Main Workspace
          </button>

          {openFunctionTabIds.map((functionId) => {
            const func = functions.find((item) => item.id === functionId);
            if (!func) return null;

            return (
              <button
                key={functionId}
                className={`workspace-tab function-tab ${
                  editingFunctionId === functionId ? "active-workspace-tab" : ""
                }`}
                onClick={() => setEditingFunctionId(functionId)}
              >
                <span>{func.name}</span>

                <span
                  className="tab-close-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeFunctionTab(functionId);
                  }}
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>

        <div className="workspace-toolbar app-font">
          <div>
            <h2>
              {editingFunction
                ? `Function: ${editingFunction.name}`
                : "Workspace"}
            </h2>
            <p>
              {editingFunction
                ? "Build this function, then switch back to the main workspace."
                : "Drop blocks into the main area or inside container blocks."}
            </p>

            {editingFunction && (
              <div className="function-editor-controls">
                <div className="function-editor-row">
                  <label>name</label>
                  <input
                    placeholder="function name"
                    value={editingFunction.name}
                    onChange={(event) =>
                      updateFunctionName(editingFunction.id, event.target.value)
                    }
                  />
                </div>

                <div className="parameter-editor">
                  <div className="parameter-header">
                    <span>Parameters</span>
                    <button onClick={() => addParameter(editingFunction.id)}>
                      + Add Parameter
                    </button>
                  </div>

                  {editingFunction.params.length === 0 && (
                    <p className="parameter-empty">No parameters yet.</p>
                  )}

                  <div className="parameter-list">
                    {editingFunction.params.map((param, index) => (
                      <div key={index} className="parameter-item">
                        <input
                          placeholder={`param ${index + 1}`}
                          value={param}
                          onChange={(event) =>
                            updateParameter(
                              editingFunction.id,
                              index,
                              event.target.value
                            )
                          }
                        />

                        <button
                          onClick={() =>
                            deleteParameter(editingFunction.id, index)
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="zoom-controls">
            <button onClick={zoomOut}>−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn}>+</button>
            <button onClick={resetZoom}>Reset</button>
          </div>
        </div>

        <div
          key={editingFunction ? `function-${editingFunction.id}` : "main"}
          className="drop-zone workspace-mode-card"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) =>
            handleDrop(event, {
              area: "root",
              index: currentBlocks.length,
            })
          }
        >
          {currentBlocks.length === 0 && (
            <div className="empty-message"></div>
          )}

          <div
            className="zoom-canvas"
            style={{
              transform: `scale(${zoom})`,
            }}
          >
            {renderBlockList(currentBlocks, "root")}
          </div>
        </div>
      </main>

      <aside className="output-panel app-font">
        <div className="output-header">
          <h2>Output</h2>
          <span>Program result</span>
        </div>

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

        {result && <pre className="result-message">{result}</pre>}

        <h3>JSON</h3>
        <pre>
          {JSON.stringify(
            {
              functions: functions.map((func) => ({
                id: func.id,
                type: "def",
                name: func.name,
                params: func.params,
                children: func.children,
              })),
              blocks,
            },
            null,
            2
          )}
        </pre>
      </aside>

      {functionToDeleteId !== null && (
        <div className="modal-backdrop">
          <div className="confirm-modal">
            <h2>Delete function?</h2>
            <p>
              This will remove the function and any blocks that call it. This
              action cannot be undone.
            </p>

            <div className="modal-actions">
              <button
                className="cancel-delete-button"
                onClick={cancelDeleteFunction}
              >
                Cancel
              </button>

              <button
                className="confirm-delete-button"
                onClick={confirmDeleteFunction}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
