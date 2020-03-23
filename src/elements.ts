const bcrpc = require('bcrpc');
const utils = require('./utils');

import { config, Configuration, RPCHost } from './config';

utils.deasyncObject(bcrpc);

const up = (config: RPCHost) => new bcrpc(
    {
        prot: 'http',
        host: config.host,
        port: config.rpcport,
        user: config.user,
        pass: config.pass,
    }
);

export const client = up(config.elementsd);

client.switchNode = (config: Configuration) => {
    const n = up(config.elementsd);
    for (const k of Object.keys(n)) {
        client[k] = n[k];
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// BTC <-> satoshi conversion
//

export const btc2sat = (btc: number) => btc * 100000000;
export const sat2btc = (sat: number) => sat / 100000000;
export const btcarr2sat = (btc: Array<number>) => {
    let sat: Array<number> = new Array<number>();
    for (const b of btc) sat.push(btc2sat(b));
    return sat;
};
export const satarr2btc = (sat: Array<number>) => {
    let btc: Array<number> = new Array<number>();
    for (const s of sat) btc.push(sat2btc(s));
}
export const btcbal2satbal = (bal: {[type: string]: number}) => {
    const r: {[type: string]: number} = {};
    for (const asset of Object.keys(bal)) {
        r[asset] = btc2sat(bal[asset]);
    }
    return r;
};
export const satbal2btcbal = (bal: {[type: string]: number}) => {
    const r: {[type: string]: number} = {};
    for (const asset of Object.keys(bal)) {
        r[asset] = sat2btc(bal[asset]);
    }
    return r;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// Elements RPC interfaces (Generic)
//

export interface IResult<IType> {
    error?: Error;
    elementsError?: {
        code: number;
        message: string;
    };
    result?: IType;
    get(): IType;
}

export class Result<IType> implements IResult<IType> {
    constructor(val: IType | Error | { code: number; message: string; }) {
        if (typeof val == "string" || typeof val == "number") {
            this.result = val;
        } else if ("code" in val) {
            this.elementsError = val;
        } else if (val instanceof Error) {
            this.error = val;
        } else {
            this.result = val;
        }
    }
    error?: Error;
    elementsError?: {
        code: number;
        message: string;
    };
    result?: IType;
    get(): IType {
        if (this.result) {
            return this.result;
        } else if (this.elementsError) {
            throw new Error(`elements error ${this.elementsError.code}: ${this.elementsError.message}`); 
        }
        throw this.error;
    }
}

const Try = <Retval>(op: () => IResult<Retval>): Result<Retval> => {
    try {
        return new Result(op().result!);
    } catch (e) {
        return new Result(e);
    }
}

const Do = <Retval>(cmd: string, ...args: Array<string | boolean | number | object | undefined>): Result<Retval> => {
    while (args.length > 0 && typeof args[args.length - 1] == "undefined") args.pop();
    return Try<Retval>(() => client[cmd](...args));
}

export interface Outpoint {
    txid: string;
    vout: number;
}

export interface ScriptSig {
    asm: string;
    hex: string;
}

export interface ScriptPubKey {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: Array<string>;
}

export interface TxIn extends Outpoint {
    scriptSig: ScriptSig;
    txinwitness: Array<string>;
    sequence: number;
}

export interface TxOut {
    value: number;
    n: number;
    scriptPubKey: ScriptPubKey;
}

export interface Transaction {
    txid: string;
    hash: string;
    size: number;
    vsize: number;
    weight: number;
    version: number;
    locktime: number;
    vin: Array<TxIn>;
    vout: Array<TxOut>;
}

export interface WalletTxEntry {
    fee: number;
    confirmations: number;
    blockhash: string;
    blockindex: number;
    blocktime: number;
    time: number;
    timereceived: number;
    "bip125-replaceable": "yes" | "no" | "unknown";
    amount: number;
}

export interface WalletTxDetails {
    address: string;
    category: "send" | "receive" | "generate" | "immature" | "orphan";
    amount: number;
    label: string;
    vout: number;
    fee: number;
    abandoned?: boolean; ///< only available for categpry = "send"
}

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: listsinceblock
//

export interface LSBTransaction extends Outpoint, WalletTxEntry, WalletTxDetails {
    comment: string;
    to: string;
}

export interface ListSinceBlockResult {
    transactions: Array<LSBTransaction>;
    removed: Array<LSBTransaction>;
    lastblock: string;
}

export const ListSinceBlock = (blockhash: string, target_confirmations: number = 1, include_watchonly: boolean = false, include_removed: boolean = true): Result<ListSinceBlockResult> =>
    Try<ListSinceBlockResult>(() => client.listSinceBlockS(blockhash, target_confirmations, include_watchonly, include_removed));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: rawblindrawtransaction
//

export const RawBlindRawTransaction = (hexstring: string, inputamountblinders: Array<string>, inputamounts: Array<number|string>, inputassets: Array<string>, inputassetblinders: Array<string>, totalblinder?: string, ignoreblindfail: boolean = true): Result<string> =>
    Try<string>(() => client.rawBlindRawTransactionS(hexstring, inputamountblinders, inputamounts, inputassets, inputassetblinders, totalblinder, ignoreblindfail));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: signrawtransactionwithwallet
//

export interface SRTWWPrevTx extends Outpoint {
    scriptPubKey: string;
    redeemScript?: string;      ///< required for P2SH
    witnessScript?: string;     ///< required for P2WSH or P2SH-P2WSH
    amount?: number | string;   ///< required if non-confidential segwit output
    amountcommitment?: string;  ///< required if confidential segwit output
}

export type SighashType = "ALL" | "NONE" | "SINGLE" | "ALL|ANYONECANPAY" | "NONE|ANYONECANPAY" | "SINGLE|ANYONECANPAY";

export interface SRTWWError extends Outpoint {
    scriptSig: string;
    sequence: number;
    error: string;
}

export interface SignRawTransactionWithWalletResult {
    hex: string;
    complete: boolean;
    errors?: Array<SRTWWError>;
    warning?: string;
}

export const SignRawTransactionWithWallet = (hexstring: string, prevtxs?: Array<SRTWWPrevTx>, sighashtype: SighashType = "ALL"): Result<SignRawTransactionWithWalletResult> =>
    Try<SignRawTransactionWithWalletResult>(() => client.signRawTransactionWithWalletS(hexstring, prevtxs, sighashtype));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: sendrawtransaction
//

export const SendRawTransaction = (hexstring: string, allowhighfees: boolean = false): Result<string> =>
    Try<string>(() => client.sendRawTransactionS(hexstring, allowhighfees));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: unblindrawtransaction
//

export interface UnblindRawTransactionResult {
    hex: string;
}

export const UnblindRawTransaction = (hex: string): Result<UnblindRawTransactionResult> => Try<UnblindRawTransactionResult>(() => client.unblindRawTransactionS(hex));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: fundrawtransaction
//

export interface FundRawTransactionOptions {
    changeAddress?: string;
    changePosition?: number;
    change_type?: string;
    includeWatching?: boolean;
    lockUnspents?: boolean;
    feeRate?: number;
    subtractFeeFromOutputs?: Array<number>;
    replaceable?: boolean;
    conf_target?: number;
    estimate_mode?: "UNSET" | "ECONOMICAL" | "CONSERVATIVE";
}

export interface FundRawTransactionResult {
    hex: string;
    fee: number;
    changepos: number;
}

export const FundRawTransaction = (hexstring: string, options?: FundRawTransactionOptions, iswitness?: boolean): Result<FundRawTransactionResult> =>
    Do<FundRawTransactionResult>('fundRawTransactionS', hexstring, options, iswitness);
    // Try<FundRawTransactionResult>(() => client.fundRawTransactionS(hexstring, options, iswitness));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: createrawtransaction
//

export interface CRTInput extends Outpoint {
    sequence: number;
}

export interface CRTAddressOutput {
    [type: string]: number;
}

export interface CRTOtherOutput {
    data?: string;
    vdata?: string;
    burn?: string;
    fee?: number;
}

export type CRTOutput = CRTAddressOutput | CRTOtherOutput;

export interface CRTOutputAssets {
    [type: string]: string;
}

export const CreateRawTransaction = (inputs: Array<CRTInput>, outputs: Array<CRTOutput>, locktime: number = 0, replaceable: boolean = false, output_assets?: CRTOutputAssets): Result<string> =>
    Try<string>(() => client.createRawTransactionS(inputs, outputs, locktime, replaceable, output_assets));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: decoderawtransaction
//

export const DecodeRawTransaction = (hexstring: string, iswitness?: boolean): Result<Transaction> =>
    Do<Transaction>('decodeRawTransactionS', hexstring, iswitness);

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getbalance
//

export type Balance = { [type: string]: number };

export const GetBalance = (dummy?: string, minconf: number = 0, include_watchonly: boolean = false, assetlabel?: string): Result<Balance> =>
    Try<Balance>(() => client.getBalanceS(dummy, minconf, include_watchonly, assetlabel));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getunconfirmedbalance
//

export const GetUnconfirmedBalance = (): Result<Balance> =>
    Try<Balance>(() => client.getUnconfirmedBalanceS());

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getnewaddress
//

export type AddressType = "legacy" | "p2sh-segwit" | "bech32";

export const GetNewAddress = (label?: string, address_type?: AddressType): Result<string> =>
    Try<string>(() => client.getNewAddressS(label, address_type));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: gettransaction
//

export interface GetTransactionResult extends WalletTxEntry {
    txid: string;
    "details" : Array<WalletTxDetails>;
    hex: string;
    walletconflicts: Array<string>;
}

export const GetTransaction = (txid: string, include_watchonly: boolean = false): Result<GetTransactionResult> =>
    Try<GetTransactionResult>(() => client.getTransactionS(txid, include_watchonly));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getblockhash
//

export const GetBlockHash = (height: number): Result<string> => Try<string>(() => client.getBlockHashS(height));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getblock
//

export interface BlockInfo {
    hash: string;
    confirmations: number;
    size: number;
    strippedsize: number;
    weight: number;
    height: number;
    version: number;
    versionHex: string;
    merkleroot: string;
    tx: Array<string>;
    time: number;
    mediantime: number;
    nonce: number;
    bits: string;
    difficulty: number;
    chainwork: string;
    nTx: number;
    signblock_witness_asm: string;
    signblock_witness_hex: string;
    dynamic_parameters: undefined | {
        current: {
            signblockscript: string;
            max_block_witness: number;
            fedpegscript: string;
            extension_space: Array<string>;
        },
        proposed: {
            signblockscript: string;
            max_block_witness: number;
            fedpegscript: string;
            extension_space: Array<string>;
        };
    };
    previousblockhash: string;
    nextblockhash: string;
}

export const GetBlock0 = (hash: string): Result<string> => Try<string>(() => client.getBlockS(hash, 0));
export const GetBlock1 = (hash: string): Result<BlockInfo> => Try<BlockInfo>(() => client.getBlockS(hash, 1));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: listunspent
//

export interface UTXO extends Outpoint {
    address: string;
    label: string;
    scriptPubKey: string;
    amount: number;
    amountcommitment: string;
    asset: string;
    assetcommitment: string;
    amountblinder: string;
    assetblinder: string;
    confirmations: number;
    redeemScript?: string;
    witnessScript?: string;
    spendable: boolean;
    solvable: boolean;
    desc?: string;
    safe: boolean;
}

export interface ListUnspentQueryOptions {
    minimumAmount?: number;
    maximumAmount?: number;
    maximumCount?: number;
    minimumSumAmount?: number;
    asset?: string;
}

export const ListUnspent = (
        minconf: number = 1,
        maxconf: number = 9999999,
        addresses: Array<string> = [],
        include_unsafe: boolean = true,
        query_options: ListUnspentQueryOptions = {}
    ): Result<Array<UTXO>> =>
        Try<Array<UTXO>>(() => client.listUnspentS(minconf, maxconf, addresses, include_unsafe, query_options));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getaddressinfo
//

export type OutputScriptType = 'nonstandard' | 'pubkey' | 'pubkeyhash' | 'scripthash' | 'multisig' | 'nulldata' | 'witness_v0_keyhash' | 'witness_v0_scripthash' | 'witness_unknown';

export type AddressLabelPurposeType = 'send' | 'receive';

export interface AddressLabel {
    name: string;
    purpose: AddressLabelPurposeType;
}

export interface AddressInfo {
    address: string;
    scriptPubKey: string;
    ismine: boolean;
    iswatchonly: boolean;
    solvable: boolean;
    desc?: string;
    isscript: boolean;
    ischange: boolean;
    iswitness: boolean;
    witness_version?: number;
    witness_program?: string;
    script?: OutputScriptType;
    hex?: string;
    pubkeys?: Array<string>;
    sigsrequired?: number;
    pubkey?: string;
    embedded?: AddressInfo;
    iscompressed?: boolean;
    confidential_key: string;
    unconfidential: string;
    confidential: string;
    label: string;
    timestamp?: number;
    hdkeypath?: string;
    hdseedid?: string;
    hdmasterfingerprint?: string;
    labels: Array<AddressLabel>;
}

export const GetAddressInfo = (address: string): Result<AddressInfo> => Try<AddressInfo>(() => client.getAddressInfoS(address));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getrawchangeaddress
//

export const GetRawChangeAddress = (address_type?: AddressType): Result<string> => Try<string>(() => client.getRawChangeAddressS(address_type));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: lockunspent
//

export const LockUnspent = (unlock: boolean, transactions?: Array<Outpoint>): Result<boolean> => Try<boolean>(() => client.lockUnspentS(unlock, transactions));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: listlockunspent
//

export const ListLockUnspent = (): Result<Array<Outpoint>> => Try<Array<Outpoint>>(() => client.listLockUnspentS());
