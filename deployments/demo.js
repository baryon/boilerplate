const { buildContractClass, bsv } = require('scryptlib');
const { loadDesc, showError, createLockingTx, sendTx, createUnlockingTx } = require('../helper');
const { privateKey } = require('../privateKey');

(async() => {
    try {
        const amount = 2000
        const newAmount = 546

        // get locking script
        const Demo = buildContractClass(loadDesc('demo_desc.json'));
        demo = new Demo(4, 7);
        
        // lock fund to the script
        const lockingTx =  await createLockingTx(privateKey.toAddress(), amount)
        lockingTx.outputs[0].setScript(demo.lockingScript)
        lockingTx.sign(privateKey)
        const lockingTxid = await sendTx(lockingTx)
        console.log('locking txid:     ', lockingTxid)
        
        // unlock
        // const unlockingFn = demo.add(11) //解锁成功
        const unlockingFn = demo.add(12) //抛出异常
        // const unlockingFn = demo.sub(-3) //解锁成功
        // const unlockingFn = demo.sub(3) //抛出异常
        console.log(unlockingFn)
        //可以事前校验，只有可以正常解锁在发送交易
        console.log(unlockingFn.verify())

        const unlockingScript = unlockingFn.toScript()
        const unlockingTx = await createUnlockingTx(lockingTxid, amount, demo.lockingScript.toASM(), newAmount)
        unlockingTx.inputs[0].setScript(unlockingScript)
        const unlockingTxid = await sendTx(unlockingTx)
        console.log('unlocking txid:   ', unlockingTxid)
        console.log('Succeeded on testnet')

        //如果将期待结果改为12，则会出错，抛出异常
        // const unlockingScript = demo.add(12).toScript()
        // Failed - StatusCodeError: 400 - "16: mandatory-script-verify-flag-failed (Script evaluated without error but finished with a false/empty top stack element)"

      } catch (error) {
        console.log('Failed on testnet')
        showError(error)
    }
})()