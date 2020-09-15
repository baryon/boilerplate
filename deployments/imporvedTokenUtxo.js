const axios = require( 'axios' );
const API_PREFIX = 'https://api.whatsonchain.com/v1/bsv/test'
const minFee = 546
const { assert } = require('chai');

const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  Bytes,
  signTx,
  PubKey,
  Sig,
  Ripemd160
} = require( 'scryptlib' );



const {
  DataLen,
  loadDesc,
  createLockingTx,
  reverseEndian,
  showError,
  string2Hex,
  hex2String,
  unlockP2PKHInput
} = require( '../helper' );
const {
  privateKey
} = require( '../privateKey' );

async function sendTx ( tx ) {
  return axios.post( `${API_PREFIX}/tx/raw`, {
    txhex: tx.serialize()
  } ).then( res => {
    return res.data
  } ).catch( e => {
    throw `${tx.hash} ${e.message}  ${e.response.data}`
  } )
}

( async () => {
  // private keys of buyers - on testnet in WIF
  const key1 = 'cUUk8fqcS8TxVt3dXDjP8pKwD6irUB5V2ebCF7UVJfW3i3kXiBjs'//'mxv7C9BaV1LGkmKNZBdDnut99z23xp6mMD'
  const key2 = 'cTBnbZst1xVysfmLvNWFKYP12Ri29osvZ7AuWPScatUcLy8kH7j1'//'muvRot22uEmcTLe3UudCz4nnnRi5tMF675'
  const key3 = 'cT9RMrxRDdZduB89BEowkTEXDF9QA612NRZiCQrZwQLeju8fv8E7'//myyZ5dBL9X7YBmnJLKDhxYteRwbcpqtUYu
  const key4 = 'cTvyRutPvYKtj39eEkRMAXBsHAY3CkdKjrHmYt3PtcNjrhb8qm1X'//mwicTqgWNoHcm2wKfj7aoWftjWmCqLnaa6
  const key5 = 'cPjPZNvnT4a2xzuYtQsqNNTtw47ERQ97SHLohmHuEoQd36t7Fn5q'//mjL6VF6VpGUHQ6jNhqnJtC6SjEHXTNP9p4
  if ( !key1 || !key2 || !key3 || !key4 || !key5 ) {
    console.log( 'You must provide private keys to purchase tokens' )
    genPrivKey()
  }

  const issuerPubKey = privateKey.publicKey
  const issuerPKH = bsv.crypto.Hash.sha256ripemd160( issuerPubKey.toBuffer() )

  const privateKeys = [ key1, key2, key3, key4, key5 ].map( k => new bsv.PrivateKey.fromWIF( k ) )
  const publicKeys = new Array( privateKeys.length )
  // PKHs for receiving change from each transaction (20 bytes - 40 hexadecimal characters)
  const pkhs = new Array( privateKeys.length )

  // generate public keys, and PKHs
  for ( k = 0; k < privateKeys.length; k++ ) {
    publicKeys[ k ] = bsv.PublicKey.fromPrivateKey( privateKeys[ k ] )
    pkhs[ k ] = bsv.crypto.Hash.sha256ripemd160( publicKeys[ k ].toBuffer() )
  }

  //签名类型 ALL
  const Signature = bsv.crypto.Signature
  // //const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
  const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID


  const ownerAddress = publicKeys[ 0 ].toAddress()
  const ownerPKH = pkhs[ 0 ]

  try {
    const Token = buildContractClass( loadDesc( 'improvedTokenUtxo_desc.json' ) )

    //Token不能增发
    const maxSupply = 1024
    const issuerPubKey = privateKey.publicKey
    const token = new Token( new PubKey( toHex( issuerPubKey ) ), maxSupply )
    //console.log(token)
    //设置初始化状态
    // name(64bytes) + symbol(16bytes) + issuer(64bytes) + rule(1byte) + decimals(1byte) + initialSupply(8bytes)   = 158bytes
    const name = "Test Fungible Token"
    const symbol = "TFT"
    const issuer = "ChainBow Co. Ltd."
    const rule = 0
    const decimals = 0
    const initialSupply = 1024
    const dataLoad = num2bin( decimals, 1 ) + num2bin( initialSupply, 8 )
    //string2Hex( name, 64 ) + string2Hex( symbol, 16 ) + string2Hex( issuer, 64 ) + num2bin( rule, 1 ) + num2bin( decimals, 1 ) + num2bin( initialSupply, 8 )
    //设置Token的初始状态
    token.dataLoad = dataLoad

    //Token的ASM代码
    console.log( token.lockingScript.toASM() )
    //console.log(token.lockingScript.toHex())


    const holderSatoshi = 546//Math.floor( ( 148 + token.lockingScript.toHex().length / 2 ) * 0.1 )

    console.log( holderSatoshi )

    const address = privateKey.toAddress()
    //获取UTXO
    // step 1: fetch utxos
    let {
      data: utxos
    } = await axios.get( `${API_PREFIX}/address/${address}/unspent` )

    utxos = utxos.map( ( utxo ) => ( {
      txId: utxo.tx_hash,
      outputIndex: utxo.tx_pos,
      satoshis: utxo.value,
      script: bsv.Script.buildPublicKeyHashOut( address ).toHex(),
    } ) )

    console.log( utxos )

    //构建第一个交易

    //从P2PKH创建一个非标输出
    const tx0 = new bsv.Transaction().from( utxos )
    //非标输出，0
    tx0.addOutput( new bsv.Transaction.Output( {
      script: token.lockingScript,
      satoshis: holderSatoshi,
    } ) )

    //找零P2PKH输出1
    tx0.change( address )

    //自动计算手续费 .fee( minFee )

    //对交易签名
    tx0.sign( privateKey )
    console.log( tx0 )

    const tx0id = tx0.hash
    console.log( tx0id )

    const utxos1 = {
      txId: tx0id,
      outputIndex: 1,
      satoshis: tx0.outputs[ 1 ].satoshis,
      script: bsv.Script.buildPublicKeyHashOut( address ).toHex(),
    }



    //创建第二个交易，解锁第一个交易的0号输出
    const tx1 = new bsv.Transaction()//.from(utxos)


    const prevLockingScript = token.lockingScript.toASM()
    console.log(prevLockingScript)

    //创世交易
    tx1.addInput( new bsv.Transaction.Input( {
      prevTxId: tx0id,
      outputIndex: 0,
      script: ''
    } ), bsv.Script.fromASM(prevLockingScript), holderSatoshi )

    //创世交易的找零UTXO
    tx1.addInput( new bsv.Transaction.Input( {
      prevTxId: tx0id,
      outputIndex: 1,
      script: ''
    } ), bsv.Script.buildPublicKeyHashOut( address ), tx0.outputs[ 1 ].satoshis )


    var writer = new bsv.encoding.BufferWriter()
    //  outpoint (32-byte hash + 4-byte little endian)
    writer.writeReverse( Buffer.from( tx0id, 'hex' ) )
    writer.writeUInt32LE( 0 )
    writer.toBuffer()

    const prevOutpoint = writer.toBuffer().toString( 'hex' )
    const contractId = tx0id
    console.log( contractId, prevOutpoint )


    //console.log( token.codePart.toASM() )

    //非标输出，0
    //创建 UTXO Token LockingScript
    // codePart + OP_RETURN + contractId(32bytes) + prevOutpoint(36bytes) + ownerPkh(20bytes) + tokenAmount(8bytes) = 96bytes
    const tokenData = num2bin( 1025, 8 )//contractId //+ prevOutpoint + toHex( ownerPKH ) + num2bin( initialSupply, 8 )
    const tokenLockingScript = token.codePart.toASM() + ' OP_RETURN ' + tokenData
    console.log( tokenLockingScript )

    tx1.addOutput( new bsv.Transaction.Output( {
      script: bsv.Script.fromASM( tokenLockingScript ),
      satoshis: holderSatoshi,
    } ) )


    //非标输出，1
    // // codePart + OP_RETURN + contractId(32bytes) + prevOutpoint(36bytes) + totalSupply(8bytes) = 76bytes
    // const batonData = contractId + prevOutpoint + num2bin( initialSupply, 8 )
    // const batonLockingScript = token.codePart.toASM() + ' OP_RETURN ' + batonData
    // // console.log( batonLockingScript )

    // tx1.addOutput( new bsv.Transaction.Output( {
    //   script: bsv.Script.fromASM( batonLockingScript ),
    //   satoshis: holderSatoshi,
    // } ) )


    // //添加通知
    // tx1.addOutput( new bsv.Transaction.Output( {
    //   script: bsv.Script.buildPublicKeyHashOut( ownerAddress ),
    //   satoshis: 546,
    // } ) )


    //找零P2PKH输出1
    tx1.change( address )

    const changeSatoshi = tx1.outputs[ tx1.outputs.length - 1 ].satoshis //tx1.outputs.length < 4 ? 0 : tx1.outputs[ 3 ].satoshis

    console.log(changeSatoshi)



    // tx1.change(address).fee(minFee)

    unlockP2PKHInput( privateKey, tx1, 1, sighashType )

    //console.log( tx1 )

    //构造preimage
    let preimage = getPreimage( tx1, prevLockingScript, holderSatoshi, 0, sighashType )
    console.log( preimage.length )


    assert.equal(prevOutpoint, preimage.slice(68,104).toString('hex'));

    //构造发行商签名
    const sig = signTx( tx1, privateKey, prevLockingScript, holderSatoshi, 0, sighashType )

    //console.log( new Sig( toHex( sig ) ), new Ripemd160( toHex( ownerPKH ) ), new Ripemd160( toHex( issuerPKH ) ), tx1.outputs[ 1 ].satoshis, new Bytes( toHex( preimage ) ), holderSatoshi )

    const initiateFn = token.initiate( new Sig( toHex( sig ) ), new Ripemd160( toHex( ownerPKH ) ), new Ripemd160( toHex( issuerPKH ) ), changeSatoshi, new Bytes( toHex( preimage ) ), holderSatoshi )

    const unlockingScript = initiateFn.toScript()
    //console.log( unlockingScript )

    tx1.inputs[ 0 ].setScript( unlockingScript )



    try {

      tx0.verify()
      tx1.verify()
      console.log( 'sending' )
      console.log( await sendTx( tx0 ) )
      console.log( await sendTx( tx1 ) )

    } catch ( e ) {
      console.log( e )
    }

  } catch ( error ) {
    console.log( 'Failed on testnet' )
    showError( error )
  }
} )()