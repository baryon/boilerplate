const { expect } = require('chai');
const { bsv, buildContractClass, signTx, toHex, getPreimage, num2bin, Sig, PubKey, Ripemd160, SigHashPreimage } = require('scryptlib');
const { inputIndex, inputSatoshis, newTx, compileContract, DataLen } = require('../../helper');

const tx = newTx();

const outputAmount = 222222

describe('Test sCrypt contract Token With Suffix In Javascript', () => {
  let token, getPreimageAfterTransfer, result

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)
  const publicKeyHash1 = publicKey1.toAddress().hashBuffer
  const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey2 = bsv.PublicKey.fromPrivateKey(privateKey2)
  const publicKeyHash2 = publicKey2.toAddress().hashBuffer

  before(() => {
    const Token = buildContractClass(compileContract('tokenWithSuffix.scrypt'))
    token = new Token()

    // initial supply 100 tokens, all tokens was be transfered
    token.setDataPart([num2bin(100, DataLen), toHex(publicKeyHash1), 'a2a5b31f6800'].join(' '))
    
    getPreimageAfterTransfer = (newHolderPKH) => {
      const newLockingScript = [token.codePart.toASM(), num2bin(100, DataLen), toHex(newHolderPKH), 'a2a5b31f6800'].join(' ')
      tx.addOutput(new bsv.Transaction.Output({
        script: bsv.Script.fromASM(newLockingScript),
        satoshis: outputAmount
      }))

      return getPreimage(tx, token.lockingScript.toASM(), inputSatoshis)
    }

    token.txContext = { tx: tx, inputIndex, inputSatoshis }
  });

  it('should succeed when transfers 100 tokens to new holder', () => {
    const preimage = getPreimageAfterTransfer(publicKeyHash2)
    const sig1 = signTx(tx, privateKey1, token.lockingScript.toASM(), inputSatoshis)
    result = token.transfer(
        new PubKey(toHex(publicKey1)),
        new Sig(toHex(sig1)),
        new Ripemd160(toHex(publicKeyHash2)),
        new SigHashPreimage(toHex(preimage)),
        outputAmount
      ).verify()
    expect(result.success, result.error).to.be.true
  });

});
