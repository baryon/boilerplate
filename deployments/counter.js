const { bsv, buildContractClass, getPreimage, toHex, num2bin, Bytes } = require('scryptlib');
const { DataLen, loadDesc, createUnlockingTx, createLockingTx, sendTx, showError  } = require('../helper');
const { privateKey } = require('../privateKey');

(async() => {
    try {
        const Counter = buildContractClass(loadDesc('counter_desc.json'))
        const counter = new Counter()
        // append state as op_return data
        counter.dataLoad = num2bin(0, DataLen)
        
        //因为要循环10次，此处设置10000satoshi的费用，放入锁定脚本
        let amount = 10000
        //每次花费1000satoshi
        const FEE = amount / 10
        
        // lock fund to the script
        //创建第一个合约，初始数据为0，因为输入是p2pkh的UTXO，可以创建任何输出
        //这一部相当于合约的创世
        const lockingTx =  await createLockingTx(privateKey.toAddress(), amount)
        lockingTx.outputs[0].setScript(counter.lockingScript)
        console.log(counter.lockingScript.toASM())
        lockingTx.sign(privateKey)
        let lockingTxid = await sendTx(lockingTx)
        console.log('funding txid:      ', lockingTxid)

        // unlock
        for (i = 0; i < 9; i++) {
          //前一个交易的锁定脚本
            let prevLockingScript = counter.lockingScript.toASM();
            
            // update state
            //设置新交易的锁定脚本，在上一个数据的基础上加一，但此处简单地用了i，容易混淆
            counter.dataLoad = num2bin(i + 1, DataLen)
            //获取新脚本
            const newLockingScript = counter.lockingScript.toASM();
            
            //每交易一次都扣除交易手续费，FEE为1000
            const newAmount = amount - FEE

            //构造解锁交易，形成新的交易
            //交易中包括一个输入，一个输出，没有找零
            const unlockingTx = await createUnlockingTx(lockingTxid, amount, prevLockingScript, newAmount, newLockingScript)

            //构造原像，输入新的解锁交易，前一个交易的锁定脚本，前一个交易的satoshi
            const preimage = getPreimage(unlockingTx, prevLockingScript, amount)
            //将原像作为参数，构造解锁脚本
            const unlockingScript = counter.increment(new Bytes(toHex(preimage)), newAmount).toScript()
            unlockingTx.inputs[0].setScript(unlockingScript)
            console.log(counter.lockingScript.toASM())

            //解锁交易发布，让比特币节点校验，如果校验成功，将花费原交易，新交易创建

            lockingTxid = await sendTx(unlockingTx)
            console.log('iteration #' + i + ' txid: ', lockingTxid)

            amount = newAmount
        }

        console.log('Succeeded on testnet')
    } catch (error) {
        console.log('Failed on testnet')
        showError(error)
    }
})()