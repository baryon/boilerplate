const { expect } = require('chai');
const { bsv, buildContractClass, toHex, getPreimage, num2bin, PubKey, Bytes } = require('scryptlib');
const { inputIndex, inputSatoshis, tx, compileContract, DataLen } = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)

describe('Test sCrypt contract TokenSale In Javascript', () => {
  let tokenSale, getPreimageAfterPurchase, result

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)
  const numTokens = 21
  const tokenPriceInSatoshis = 100

  before(() => {
    //名字叫做TokenSale，每次花费，会在锁定脚本后面填上购买者的公钥pk和购买的数量，并且要求添加数量乘以价格的Satoshi
    //所有的Satoshi被绑在合约中只能增加无法花费
    const TokenSale = buildContractClass(compileContract('tokenSale.scrypt'))
    console.log(TokenSale)
    tokenSale = new TokenSale(tokenPriceInSatoshis)
    console.log(tokenSale)

    // initial empty state
    tokenSale.dataLoad = num2bin(1024, 8)

    getPreimageAfterPurchase = (publicKey) => {
      console.log(tokenSale.codePart.toASM())
      const newLockingScriptHex = tokenSale.lockingScript.toHex() + toHex(publicKey) + num2bin(numTokens, DataLen)
      tx_.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.fromHex(newLockingScriptHex),
        satoshis: inputSatoshis + numTokens * tokenPriceInSatoshis
      }))

      return getPreimage(tx_, tokenSale.lockingScript.toASM(), inputSatoshis)
    }
  });

  it('should succeed when publicKey1 buys tokens', () => {
    // any contract that includes checkSig() must be verified in a given context
    const context = { tx: tx_, inputIndex, inputSatoshis }
    const preimage = getPreimageAfterPurchase(publicKey1)
    result = tokenSale.buy(
        new PubKey(toHex(publicKey1)),
        numTokens,
        new Bytes(toHex(preimage))
      ).verify(context)
    expect(result.success, result.error).to.be.true
  });
});
