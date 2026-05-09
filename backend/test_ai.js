require('dotenv').config({ path: './.env' });
const { generateSummary } = require('./src/utils/ai.util');

async function test() {
  const result = await generateSummary([{ speakerName: 'Presenter', speakerRole: 'presenter', text: 'Hello, welcome to this class.' }]);
  console.log('RESULT:', result);
}
test();
