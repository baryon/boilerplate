const { expect } = require('chai');
const { bsv, buildContractClass, Ripemd160, Sig, PubKey, signTx, toHex } = require('scryptlib');

/**
 * an example test for contract containing signature verification
 */
const { compileContract, inputIndex, inputSatoshis, newTx } = require('../../helper');

const privateKey = new bsv.PrivateKey.fromRandom('testnet')
const publicKey = privateKey.publicKey
const pkh = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())
const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')
const tx = newTx();

describe('Test sCrypt contract ClassicP2PKH In Javascript', () => {
  let demo, sig, context

  before(() => {
    const ClassicP2PKH = buildContractClass(compileContract('p2pkhClassic.scrypt'))
    demo = new ClassicP2PKH()
    const asmVarsGenesis = {
      'ClassicP2PKH.unlock.pkh': toHex(pkh)
    }
    demo.replaceAsmVars(asmVarsGenesis)

    // any contract that includes checkSig() must be verified in a given context
    context = { tx, inputIndex, inputSatoshis }
  });

  it('signature check should succeed when right private key signs', () => {
    sig = signTx(tx, privateKey, demo.lockingScript.toASM(), inputSatoshis)
    result = demo.unlock(new Sig(toHex(sig)), new PubKey(toHex(publicKey))).verify(context)
    expect(result.success, result.error).to.be.true
    /*
     * print out parameters used in debugger, see ""../.vscode/launch.json" for an example
      console.log(toHex(pkh))
      console.log(toHex(sig))
      console.log(toHex(publicKey))
      console.log(tx.toString())
    */
  });

  it('signature check should fail when wrong private key signs', () => {
    sig = signTx(tx, privateKey2, demo.lockingScript.toASM(), inputSatoshis)
    result = demo.unlock(new Sig(toHex(sig)), new PubKey(toHex(publicKey))).verify(context)
    expect(result.success, result.error).to.be.false
  });
});
