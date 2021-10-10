/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persistent storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const BlockClass = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = -1;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === -1) {
      let block = new BlockClass.Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * Utility method that return a Promise that will resolve with the height of the chain
   */
  getChainHeight() {
    let self = this;
    return new Promise((resolve, reject) => {
      resolve(self.height);
    });
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        // Get and assign previous block hash to block to be added
        const chainHeight = await self.getChainHeight();
        const previousBlockHash = await self.getBlockByHeight(chainHeight).hash;
        block.previousBlockHash = previousBlockHash;

        // Assign timestamp and correct height
        block.time = new Date().getTime().toString().slice(0, -3);
        block.height = chainHeight + 1;

        // Create and assign the block hash then push to chain
        const hash = SHA256(JSON.stringify(block)).toString();
        block.hash = hash;

        // Add block to chain
        self.chain.push(block);

        // Increase chain height by 1
        self.height += 1;

        // Resolve with block added
        return resolve("Block added");
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      return resolve(
        `${address}:${new Date()
          .getTime()
          .toString()
          .slice(0, -3)}:starRegistry`
      );
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    let self = this;
    return new Promise(async (resolve, reject) => {
      try {
        // 5 minutes
        const fiveMinutes = 60 * 5;

        // Get time from message
        const messageTime = parseInt(message.split(":")[1]);

        // Get currentTime
        const currentTime = parseInt(
          new Date().getTime().toString().slice(0, -3)
        );

        // Check if time elapsed is less than 5 minutes
        if (currentTime - messageTime >= fiveMinutes)
          return reject(
            "5 minutes or more has elapsed, can't register this new block"
          );

        // Verify message
        if (!bitcoinMessage.verify(message, address, signature))
          return reject(`${message}:${address}:${signature} can't be verified`);

        // Create block and add to chain
        const block = new BlockClass.Block({
          address,
          message,
          signature,
          star,
        });

        await self._addBlock(block);
        return resolve("Block added");
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      try {
        const foundBlock = self.chain.find((block) => block.hash === hash);
        if (!foundBlock) return reject(`Can't find block with hash: ${hash}`);
        return resolve(foundBlock);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter((p) => p.height === height)[0];
      if (block) {
        resolve(block);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    let stars = [];
    return new Promise((resolve, reject) => {
      try {
        // Find all stars by address on chain
        self.chain.forEach((block) => {
          // Skip genesis block
          if (!block.height) return;
          // Decode body and add found star to array stars
          const blockBodyDecoded = block.getBData();
          const star =
            blockBodyDecoded &&
            blockBodyDecoded.address === address &&
            blockBodyDecoded.star;
          if (star) stars.push(star);
        });

        // Return found stars
        return resolve(stars);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  validateChain() {
    let self = this;
    let errorLog = [];
    return new Promise((resolve, reject) => {
      self.chain.forEach((block) => {
        (async () => {
          try {
            // Is current block valid?
            const valid = await block.validate();
            if (!valid)
              errorLog.push({
                error: `Block validation failed at height ${block.height}`,
              });

            // Is previous block hash the same?
            const previousBlock = await self.getBlockByHeight(block.height - 1);
            if (previousBlock.hash !== block.previousBlockHash)
              errorLog.push({
                error: `Previous block hash validation failed at height ${block.height}`,
              });
          } catch (error) {
            return reject(error);
          }
        })();
      });

      if (errorLog.length) return reject(errorLog);
      return resolve("Chain is valid");
    });
  }
}

module.exports.Blockchain = Blockchain;
