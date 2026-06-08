//handle block logic
const variables = {};

function runBlocks(blocks) {
    const results = [];

    for (const block of blocks) {
        try {
            if (block.type === 'assignment') {
                const num = parseFloat(block.value);
                variables[block.variable] = isNaN(num) ? block.value : num;

                results.push({
                    id: block.id,
                    status: 'ok',
                    action: `${block.variable} = ${variables[block.variable]}`
                });
            } else {
                results.push({
                    id: block.id,
                    status: 'error',
                    message: `Unknown block type: ${block.type}`
                });
            }
        } catch (err) {
            results.push({ id: block.id, status: 'error', message: err.message });
        }
    }

    return { variables, results };
}

module.exports = { runBlocks };