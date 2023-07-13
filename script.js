const chatHistory = document.getElementById('chat-history');
const apiKeyInput = document.getElementById('api-key-input');
const apiEndpointInput = document.getElementById('api-endpoint-input');
const messageInput = document.getElementById('message-input');
const modelMenu = document.getElementById('model-menu');
const aiThinkingMsg = document.getElementById('ai-thinking');
const systemRoleInput = document.getElementById('system-role-input');

let messages = [
  {
    role: 'system',
    content: localStorage.getItem('systemRole') || 'You are a helpful assistant.',
  },
];

let apiKey = localStorage.getItem('apiKey') || '';
let apiEndpoint = localStorage.getItem('apiEndpoint') || '';
let selectedModel = localStorage.getItem('selectedModel') || 'gpt-3.5-turbo';

apiKeyInput.value = apiKey;
apiEndpointInput.value = apiEndpoint;
selectModel(selectedModel);
updateModelHeading();

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${messageInput.scrollHeight}px`;
});

messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    messageInput.value += '\n';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
  }
});

document.getElementById('send-button').addEventListener('click', sendMessage);

function toggleModelMenu() {
  modelMenu.style.display = modelMenu.style.display === 'none' ? 'block' : 'none';
}

function selectModel(model) {
  const modelOptions = document.querySelectorAll('ul li');
  modelOptions.forEach((option) => option.classList.remove('selected'));

  const selectedModelOption = document.querySelector(`ul li[data-model="${model}"]`);
  if (selectedModelOption) {
    selectedModelOption.classList.add('selected');
  }

  selectedModel = model;
  localStorage.setItem('selectedModel', selectedModel);

  toggleModelMenu();
  updateModelHeading();
}

function updateModelHeading() {
  const modelHeading = document.querySelector('h1');
  modelHeading.textContent = `Chat with ${selectedModel}`;
}

const ENDPOINT = apiEndpoint || 'https://chimeragpt.adventblocks.cc/v1/chat/completions';

async function getBotResponse(apiKey, apiEndpoint, message) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  let maxTokens;
  switch (selectedModel) {
    case 'gpt-3.5-turbo':
    case 'gpt-3.5-turbo-0613':
      maxTokens = 4096;
      break;
    case 'gpt-3.5-turbo-16k':
    case 'gpt-3.5-turbo-16k-poe':
    case 'gpt-3.5-turbo-16k-0613':
      maxTokens = 16384;
      break;
    case 'gpt-4-0613':
    case 'gpt-4':
    case 'gpt-4-poe':
      maxTokens = 8192;
      break;
    case 'gpt-4-32k-0613':
    case 'gpt-4-32k':
    case 'gpt-4-32k-poe':
      maxTokens = 32768;
      break;
    case 'claude-2-100k':
    case 'claude-instant-100k':
      maxTokens = 102400;
      break;
   case 'claude-instant':
      maxTokens = 10240;
      break;
    default:
      maxTokens = 4096;
  }

  let tokenCount = getTokenCount(messages[0].content);
  for (let i = 1; i < messages.length; i++) {
    const messageTokenCount = getTokenCount(messages[i].content);
    if (tokenCount + messageTokenCount > maxTokens) {
      messages.splice(1, i - 1);
      break;
    }
    tokenCount += messageTokenCount;
  }

  messages.push({
    role: 'user',
    content: message,
  });

  const data = {
    model: selectedModel,
    messages: messages,
    stream: true,
  };

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(data),
  });

  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      aiThinkingMsg.style.display = 'none';
      break;
    }

    const jsonResponse = new TextDecoder().decode(value);
       const botResponse = JSON.parse(jsonResponse).choices[0].message.content;
    messages.push({
      role: 'assistant',
      content: botResponse,
    });

    createAndAppendMessage(botResponse, 'bot');
  }
}

function getTokenCount(text) {
  const words = text.trim().split(/\s+/);
  return words.length;
}

async function createAndAppendMessage(content, owner) {
  const message = document.createElement('div');
  message.classList.add('message', owner);

  let displayedText = content;

  const parsedContent = parseResponse(displayedText);
  message.innerHTML = parsedContent;

  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  MathJax.Hub.Queue(['Typeset', MathJax.Hub, message]);
}

function parseResponse(response) {
  let parsedResponse = response;

  parsedResponse = parsedResponse.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  parsedResponse = parsedResponse.replace(/\$\$(.*?)\$\$/g, '<span class="mathjax-latex">\\($1\\)</span>');
  parsedResponse = parsedResponse.replace(/\$(.*?)\$/g, '<span class="mathjax-latex">\\($1\\)</span>');
  parsedResponse = parseTables(parsedResponse);

  return parsedResponse;
}

function parseTables(response) {
  const tableRegex = /\n((?:\s*:?[\|:].*\|\n)+)\n/g;
  return response.replace(tableRegex, createTable);
}

function createTable(match, table) {
  const rows = table.trim().split('\n');
  const tableElement = document.createElement('table');

  const tableHeader = document.createElement('tr');
  const tableHeaderCells = rows[0].split('|').slice(1, -1);
  tableHeaderCells.forEach((cell) => {
    const th = document.createElement('th');
    th.classList.add('table-header');
    th.textContent = cell.trim();
    tableHeader.appendChild(th);
  });
  tableElement.appendChild(tableHeader);

  for (let i = 2; i < rows.length; i++) {
    const row = document.createElement('tr');
    const tableCells = rows[i].split('|').slice(1, -1);
    tableCells.forEach((cell) => {
      const td = document.createElement('td');
      td.classList.add('table-data');
      td.innerHTML = parseResponse(cell.trim());
      row.appendChild(td);
    });
    tableElement.appendChild(row);
  }

  return tableElement.outerHTML;
}

async function sendMessage() {
  apiKey = apiKeyInput.value.trim();
  apiEndpoint = apiEndpointInput.value.trim();
  const message = messageInput.value.trim();

  if (!apiKey || !message) {
    alert('Please enter your API key and a message.');
    return;
  }

  localStorage.setItem('apiKey', apiKey);
  localStorage.setItem('apiEndpoint', apiEndpoint);

  createAndAppendMessage(message, 'user');
  messageInput.value = '';
  messageInput.style.height = 'auto';

  aiThinkingMsg.style.display = 'block';
  await getBotResponse(apiKey, apiEndpoint, message);
}

function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

document.getElementById('copy-button').addEventListener('click', () => {
  const latestResponse = chatHistory.lastElementChild.innerHTML;
  if (latestResponse) {
    copyToClipboard(latestResponse);
    alert('Text copied to clipboard');
  } else {
    alert('No text to copy');
  }
});

systemRoleInput.value = localStorage.getItem('systemRole') || 'You are a helpful assistant.';
systemRoleInput.addEventListener('input', () => {
  localStorage.setItem('systemRole', systemRoleInput.value);
  messages[0].content = systemRoleInput.value;
});

window.addEventListener('load', updateModelHeading);
