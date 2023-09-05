
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Web3 = require('web3');
const bot = new TelegramBot('BOT_TOKEN', { polling: true });
const etherscanApiKey = 'ETHERSCAN_API_KEY';
const web3 = new Web3('ALCHEMY_NODE_URL');
 
const schedule = require('node-schedule');



bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🔰Welcome,\n\n use /alert <token address> <threshold mcap> to get notified when a token reaches a particular market cap');
});



const userSubscriptions = new Map();

function formatNumber(number) {
  if (number >= 1e9) {
    return (number / 1e9).toFixed(1) + 'B';
  } else if (number >= 1e6) {
    return (number / 1e6).toFixed(1) + 'M';
  } else if (number >= 1e3) {
    return (number / 1e3).toFixed(1) + 'k';
  } else {
    return number.toString();
  }
}

async function checkMarketCap(chatId, erc20TokenAddress, thresholdMarketCap) {
  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${erc20TokenAddress}`);
    const pairs = response.data.pairs;

    if (pairs.length > 0) {
      const tokenData = pairs[0];
      const marketCap = tokenData.fdv;

      if (marketCap > thresholdMarketCap) {
        const tokenName = tokenData.baseToken.name;
        const tokenSymbol = tokenData.baseToken.symbol;
        const tokenPrice = tokenData.priceUsd;
        const formattedMarketCap = formatNumber(marketCap);

        bot.sendMessage(chatId, `💠Token: ${tokenName} (${tokenSymbol})\n💹Price: $${tokenPrice}\n⏳Market Cap: $${formattedMarketCap}\n✅Market Cap exceeded the threshold of $${formatNumber(thresholdMarketCap)}`);
        
        // Remove the user subscription after sending the alert
        userSubscriptions.delete(chatId);
      }
    }
  } catch (error) {
    console.error('Error checking market cap:', error);
  }
}

bot.onText(/\/alert (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userInput = match[1].trim();
  const userInputParts = userInput.split(' ');

  if (userInputParts.length !== 2) {
    bot.sendMessage(chatId, '❌Please provide both the token address and the threshold market cap.');
    return;
  }

  const erc20TokenAddress = userInputParts[0];
  const thresholdMarketCap = parseFloat(userInputParts[1]);

  if (!erc20TokenAddress.startsWith('0x') || isNaN(thresholdMarketCap)) {
    bot.sendMessage(chatId, '❌Please provide a valid token address and a valid threshold market cap.');
    return;
  }

  try {
    const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${erc20TokenAddress}`);
    const pairs = response.data.pairs;

    if (pairs.length > 0) {
      const tokenData = pairs[0];
      const currentMarketCap = tokenData.fdv;

      bot.sendMessage(
        chatId,
        `✅You will receive a one-time notification if the token's market cap exceeds $${formatNumber(thresholdMarketCap)}.`
      );

      // Set up the one-time check for market cap
      checkMarketCap(chatId, erc20TokenAddress, thresholdMarketCap);

      // Store the user subscription for later reference (not needed for one-time alerts)
      userSubscriptions.set(chatId, { address: erc20TokenAddress, threshold: thresholdMarketCap });
    } else {
      bot.sendMessage(chatId, '❌Token not found or no available data.');
    }
  } catch (error) {
    bot.sendMessage(chatId, '❌Error fetching token information.');
  }
});