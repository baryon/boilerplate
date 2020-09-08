const { expect } = require('chai');
const { bsv, buildContractClass, signTx, toHex, getPreimage, num2bin, Sig, PubKey, Bytes } = require('scryptlib');
const { inputIndex, inputSatoshis, tx, compileContract, DataLen } = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)

const outputAmount = 222222

describe('Test sCrypt contract Token In Javascript', () => {
  let token, getPreimageAfterTransfer, result

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)
  const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey2 = bsv.PublicKey.fromPrivateKey(privateKey2)
  
  before(() => {
    const Token = buildContractClass(compileContract('token.scrypt'))
    console.log(Token)
    token = new Token()
    console.log(token)
    // initial supply 100 tokens: publicKey1 has 100, publicKey2 0
    token.dataLoad = toHex(publicKey1) + num2bin(100, DataLen) + toHex(publicKey2) + num2bin(0, DataLen)
    console.log(token.lockingScript.toASM())

    getPreimageAfterTransfer = (balance1, balance2) => {
      const newLockingScript = token.codePart.toASM() + ' OP_RETURN ' + toHex(publicKey1) + num2bin(balance1, DataLen) + toHex(publicKey2) + num2bin(balance2, DataLen)
      console.log(newLockingScript)

      tx_.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.fromASM(newLockingScript),
        satoshis: outputAmount
      }))

      return getPreimage(tx_, token.lockingScript.toASM(), inputSatoshis)
    }

    token.txContext = { tx: tx_, inputIndex, inputSatoshis }
  });

  it('should succeed when publicKey1 transfers 40 tokens to publicKey2', () => {
    // after transfer 40 tokens: publicKey1 has 60, publicKey2 40
    const preimage = getPreimageAfterTransfer(60, 40)
    const sig1 = signTx(tx_, privateKey1, token.lockingScript.toASM(), inputSatoshis)
    result = token.transfer(
        new PubKey(toHex(publicKey1)),
        new Sig(toHex(sig1)),
        new PubKey(toHex(publicKey2)),
        40,
        new Bytes(toHex(preimage)),
        outputAmount
      ).verify()
    expect(result.success, result.error).to.be.true
  });

  it('should fail due to wrong balances', () => {
    // after transfer 40 tokens: publicKey1 has 60, publicKey2 40
    const preimage = getPreimageAfterTransfer(60, 30)
    const sig1 = signTx(tx_, privateKey1, token.lockingScript.toASM(), inputSatoshis)
    result = token.transfer(
          new PubKey(toHex(publicKey1)),
          new Sig(toHex(sig1)),
          new PubKey(toHex(publicKey2)),
          40,
          new Bytes(toHex(preimage)),
          outputAmount
        ).verify()
    expect(result.success, result.error).to.be.false
  });

  it('should fail when publicKey2 transfers 40 tokens to publicKey1 due to insufficient balance', () => {
    const preimage = getPreimageAfterTransfer(60, 40)
    const sig2 = signTx(tx_, privateKey2, token.lockingScript.toASM(), inputSatoshis)
    result = token.transfer(
          new PubKey(toHex(publicKey2)),
          new Sig(toHex(sig2)),
          new PubKey(toHex(publicKey1)),
          40,
          new Bytes(toHex(preimage)),
          outputAmount
        ).verify()
    expect(result.success, result.error).to.be.false
  });

  it('should fail when publicKey1 transfers 40 tokens to publicKey2 due to wrong signature', () => {
    const preimage = getPreimageAfterTransfer(60, 40)
    const sig2 = signTx(tx_, privateKey2, token.lockingScript.toASM(), inputSatoshis)
    result = token.transfer(
          new PubKey(toHex(publicKey1)),
          new Sig(toHex(sig2)),
          new PubKey(toHex(publicKey2)),
          40,
          new Bytes(toHex(preimage)),
          outputAmount
        ).verify()
    expect(result.success, result.error).to.be.false
  });
});
