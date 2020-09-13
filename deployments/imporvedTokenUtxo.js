const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  Bytes,
  signTx,
  PubKey,
  Sig
} = require( 'scryptlib' );
const {
  DataLen,
  loadDesc,
  createLockingTx,
  sendTx,
  reverseEndian,
  showError,
  string2Hex,
  hex2String,
} = require( '../helper' );
const {
  privateKey
} = require( '../privateKey' );

( async () => {
  const privateKey1 = new bsv.PrivateKey.fromRandom( 'testnet' )
  const publicKey1 = bsv.PublicKey.fromPrivateKey( privateKey1 )
  const privateKey2 = new bsv.PrivateKey.fromRandom( 'testnet' )
  const publicKey2 = bsv.PublicKey.fromPrivateKey( privateKey2 )
  const privateKey3 = new bsv.PrivateKey.fromRandom( 'testnet' )
  const publicKey3 = bsv.PublicKey.fromPrivateKey( privateKey3 )

  try {
    const Token = buildContractClass( loadDesc( 'improvedTokenUtxo_desc.json' ) )

    //计算需要多少satoshi才能避免被当成dust
    //根据节点代码所示，dust的计算是输入(148+输出的大小)*最小重放手续费*3
    //手续费，我们设置为0.5， 只要最后除以2
    //标准手续费为1，所有节点都会接收
    //普通收费可以设置为0.5
    //一些矿池可以接受0.25
    //但存在一个问题就是，如果以后费率有波动，更高或者更低
    // function calcHolderSatoshi () {
    //   //创建一个Dummy Token
    //   const token = new Token( new PubKey( toHex( issuerPubKey ) ), 0, 0 )
    //   //根据Dummy Token的脚本长度，计算holderSatoshi
    //   holderSatoshi = (148 + token.codePart.toHex().length / 2) * 3 / 2
    //   console.log( holderSatoshi )
    //   return holderSatoshi
    // }

    //Token增发无限制
    const maxSupply = 0
    const token = new Token(new PubKey(toHex(issuerPubKey)), maxSupply, holderSatoshi)
    //console.log(token)
    //设置初始化状态
    // name(64bytes) + symbol(16bytes) + issuer(64bytes) + rule(1byte) + decimals(1byte) + initialSupply(8bytes)   = 158bytes
    const name = "Test Fungible Token"
    const symbol = "TFT"
    const issuer = "ChainBow Co. Ltd."
    // const holderSatoshi = calcHolderSatoshi()
    const rule = 0
    const decimals = 0
    const initialSupply = 1024
    const dataLoad =  string2Hex(name, 64) + string2Hex(symbol, 16) + string2Hex(issuer, 64) + num2bin(rule, 1) + num2bin(decimals, 1) + num2bin(initialSupply, 8)
    
    token.dataLoad = dataLoad


    let inputSatoshis = 10000
    const FEE = inputSatoshis / 4
    let outputAmount = Math.floor( ( inputSatoshis - FEE ) / 2 )

    // lock fund to the script
    const lockingTx = await createLockingTx( privateKey.toAddress(), inputSatoshis, FEE )
    lockingTx.outputs[ 0 ].setScript( token.lockingScript )
    lockingTx.sign( privateKey )
    let lockingTxid = await sendTx( lockingTx )
    console.log( 'funding txid:      ', lockingTxid )

    // split one UTXO of 100 tokens into one with 70 tokens and one with 30
    let splitTxid, lockingScript0, lockingScript1
    {
      const tx = new bsv.Transaction()
      tx.addInput( new bsv.Transaction.Input( {
        prevTxId: lockingTxid,
        outputIndex: 0,
        script: ''
      } ), token.lockingScript, inputSatoshis )

      lockingScript0 = token.codePart.toASM() + ' OP_RETURN ' + toHex( publicKey2 ) + num2bin( 0, DataLen ) + num2bin( 70, DataLen )
      tx.addOutput( new bsv.Transaction.Output( {
        script: bsv.Script.fromASM( lockingScript0 ),
        satoshis: outputAmount
      } ) )
      lockingScript1 = token.codePart.toASM() + ' OP_RETURN ' + toHex( publicKey3 ) + num2bin( 0, DataLen ) + num2bin( 30, DataLen )
      tx.addOutput( new bsv.Transaction.Output( {
        script: bsv.Script.fromASM( lockingScript1 ),
        satoshis: outputAmount
      } ) )

      const preimage = getPreimage( tx, token.lockingScript.toASM(), inputSatoshis )
      const sig1 = signTx( tx, privateKey1, token.lockingScript.toASM(), inputSatoshis )
      const unlockingScript = token.split(
        new Sig( toHex( sig1 ) ),
        new PubKey( toHex( publicKey2 ) ),
        70,
        outputAmount,
        new PubKey( toHex( publicKey3 ) ),
        30,
        outputAmount,
        new Bytes( toHex( preimage ) )
      ).toScript()
      tx.inputs[ 0 ].setScript( unlockingScript );
      splitTxid = await sendTx( tx );
      console.log( 'split txid:       ', splitTxid )
    }

    inputSatoshis = outputAmount
    outputAmount -= FEE
    // merge one UTXO with 70 tokens and one with 30 into a single UTXO of 100 tokens
    {
      const tx = new bsv.Transaction()
      tx.addInput( new bsv.Transaction.Input( {
        prevTxId: splitTxid,
        outputIndex: 0,
        script: ''
      } ), bsv.Script.fromASM( lockingScript0 ), inputSatoshis )

      tx.addInput( new bsv.Transaction.Input( {
        prevTxId: splitTxid,
        outputIndex: 1,
        script: ''
      } ), bsv.Script.fromASM( lockingScript1 ), inputSatoshis )

      const lockingScript2 = token.codePart.toASM() + ' OP_RETURN ' + toHex( publicKey1 ) + num2bin( 70, DataLen ) + num2bin( 30, DataLen )
      tx.addOutput( new bsv.Transaction.Output( {
        script: bsv.Script.fromASM( lockingScript2 ),
        satoshis: outputAmount
      } ) )

      // use reversed txid in outpoint
      const txHash = reverseEndian( splitTxid )
      const prevouts = txHash + num2bin( 0, 4 ) + txHash + num2bin( 1, 4 )

      // input 0
      {
        const preimage = getPreimage( tx, lockingScript0, inputSatoshis, 0 )
        const sig2 = signTx( tx, privateKey2, lockingScript0, inputSatoshis, 0 )
        const unlockingScript = token.merge(
          new Sig( toHex( sig2 ) ),
          new PubKey( toHex( publicKey1 ) ),
          new Bytes( prevouts ), 30, outputAmount,
          new Bytes( toHex( preimage ) )
        ).toScript()
        tx.inputs[ 0 ].setScript( unlockingScript );
      }

      // input 1
      {
        const preimage = getPreimage( tx, lockingScript1, inputSatoshis, 1 )
        const sig3 = signTx( tx, privateKey3, lockingScript1, inputSatoshis, 1 )
        const unlockingScript = token.merge(
          new Sig( toHex( sig3 ) ),
          new PubKey( toHex( publicKey1 ) ),
          new Bytes( prevouts ), 70, outputAmount,
          new Bytes( toHex( preimage ) )
        ).toScript()
        tx.inputs[ 1 ].setScript( unlockingScript );
      }

      const mergeTxid = await sendTx( tx );
      console.log( 'merge txid:       ', mergeTxid )
    }

    console.log( 'Succeeded on testnet' )
  } catch ( error ) {
    console.log( 'Failed on testnet' )
    showError( error )
  }
} )()