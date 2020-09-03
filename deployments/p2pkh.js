const { buildContractClass, toHex, signTx, Ripemd160, Sig, PubKey, bsv } = require('scryptlib');

const {
  createLockingTx,
  createUnlockingTx,
  sendTx,
  showError,
  loadDesc
} = require('../helper')

const { privateKey } = require('../privateKey');

async function main() {
  try {
    const publicKey = privateKey.publicKey

    // Initialize contract
    const P2PKH = buildContractClass(loadDesc('p2pkh_desc.json'))
    const publicKeyHash = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())
    const p2pkh = new P2PKH(new Ripemd160(toHex(publicKeyHash)))

    // deploy contract on testnet
    const amountInContract = 10000
    //创建一个锁定交易，在0的位置上使用空脚本
    const deployTx = await createLockingTx(privateKey.toAddress(), amountInContract)
    //在0的位置上填充合约创建的脚本
    deployTx.outputs[0].setScript(p2pkh.lockingScript)
    deployTx.sign(privateKey)
    const deployTxId = await sendTx(deployTx)
    console.log('Contract Deployed Successfully! TxId: ', deployTxId)

    // call contract method on testnet
    const spendAmount = amountInContract / 10
    //创建一个空的交易，输出部分仍然是一个合约脚本
    const methodCallTx = createUnlockingTx(deployTxId, amountInContract, p2pkh.lockingScript.toASM(), spendAmount)
    const sig = signTx(methodCallTx, privateKey, p2pkh.lockingScript.toASM(), amountInContract)
    //创建解锁脚本
    const unlockingScript = p2pkh.unlock(new Sig(toHex(sig)), new PubKey(toHex(publicKey))).toScript()
    //置换输入脚本
    methodCallTx.inputs[0].setScript(unlockingScript)
    const methodCallTxId = await sendTx(methodCallTx)
    console.log('Contract Method Called Successfully! TxId: ', methodCallTxId)

  } catch (error) {
    console.log('Failed on testnet')
    showError(error)
  }
}

main()