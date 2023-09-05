const TelegramBot = require('node-telegram-bot-api');
const Web3 = require('web3');
const EthereumTx = require('ethereumjs-tx').Transaction;
const IUniswapV2Router02 = require('./IUniswapV2Router02.json');

// Replace these with actual values
const botToken = 'BOT_TOKEN';
const ethereumNodeURL = 'NODE_URL';
const privateKey = 'PRIVATE_KEY'; // Securely manage private key
const walletAddress = 'WALLET_ADDRESS'; // Your wallet address

const bot = new TelegramBot(botToken, { polling: true });
const web3 = new Web3(ethereumNodeURL);

const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const uniswapRouterContract = new web3.eth.Contract(IUniswapV2Router02, uniswapRouterAddress);

const waitForAmount = {};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    bot.sendMessage(chatId, `Hello ${username}, I am SniperBot demo. \n\n Getting ready...`);
    bot.sendMessage(chatId, 'Use /buytoken <token address> to buy an ERC-20 token.');
});

bot.onText(/\/buytoken (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const tokenAddress = match[1];

    if (!web3.utils.isAddress(tokenAddress)) {
        bot.sendMessage(chatId, 'Invalid token address.');
        return;
    }

    bot.sendMessage(chatId, 'Enter the amount of ETH you want to spend on buying:');
    waitForAmount[chatId] = { type: 'buy', tokenAddress };
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (waitForAmount[chatId]) {
        const amount = text.trim();
        const { type, tokenAddress } = waitForAmount[chatId];
        delete waitForAmount[chatId];

        try {
            const path = [walletAddress, tokenAddress]; // Swap ETH for the specified token
            const amountIn = web3.utils.toWei(amount, 'ether');
            const amountOutMin = '0';
            const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

            const txParams = {
                nonce: await web3.eth.getTransactionCount(walletAddress),
                gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
                gasLimit: web3.utils.toHex(21000),
                to: uniswapRouterAddress,
                value: web3.utils.toHex(amountIn), // Send ETH to the router
                data: uniswapRouterContract.methods.swapExactETHForTokens(amountOutMin, path, walletAddress, deadline).encodeABI()
            };

            const tx = new EthereumTx(txParams, { chain: 'mainnet', hardfork: 'petersburg' });
            const privateKeyBuffer = Buffer.from(privateKey, 'hex');
            tx.sign(privateKeyBuffer);

            const serializedTx = tx.serialize();
            const txHash = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

            console.log('Transaction Hash:', txHash);
            bot.sendMessage(chatId, `Transaction successful. Transaction Hash: ${txHash}`);
        } catch (error) {
            console.error('Error:', error);
            bot.sendMessage(chatId, `${error}`);
        }
    }
});
