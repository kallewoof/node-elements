const bcrpc = require('bcrpc');

import { config, Configuration, RPCHost } from './config';

const up = (cfg: RPCHost) => new bcrpc(
    {
        prot: 'http',
        host: cfg.host,
        port: cfg.rpcport,
        user: cfg.user,
        pass: cfg.pass,
    }
);

export const client = up(config.elementsd);

client.switchNode = (cfg: Configuration) => {
    const n = up(cfg.elementsd);
    for (const k of Object.keys(n)) {
        client[k] = n[k];
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////
// BTC <-> satoshi conversion
//

export const btc2sat = (btc: number) => btc * 100000000;
export const sat2btc = (sat: number) => sat / 100000000;
export const btcarr2sat = (btc: number[]) => {
    const sat: number[] = [];
    for (const b of btc) sat.push(btc2sat(b));
    return sat;
};
export const satarr2btc = (sat: number[]) => {
    const btc: number[] = [];
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

export class ElementsError extends Error {
    code: number;
    constructor(code: number, message: string) {
        super(message);
        this.name = "ElementsError";
        this.code = code;
    }
}

const ParseResult = <IType>(val: IType | Error | { code: number; message: string; }): IType => {
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        return val;
    } else if ("code" in val) {
        throw new ElementsError(val.code, val.message);
    } else if (val instanceof Error) {
        throw val;
    }
    return val;
};

const Try = async <Retval>(p: Promise<IResult<Retval>>): Promise<Retval> => {
    try {
        const r = await p;
        return ParseResult(r.result!);
    } catch (e) {
        return Promise.reject(e);
    }
}

const Do = async <Retval>(
        cmd: string,
        ...args: (string | boolean | number | object | undefined)[])
: Promise<Retval> => {
    while (args.length > 0 && typeof args[args.length - 1] === "undefined") args.pop();
    return Try<Retval>(client[cmd](...args));
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
    addresses: string[];
}

export interface TxIn extends Outpoint {
    scriptSig: ScriptSig;
    txinwitness: string[];
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
    vin: TxIn[];
    vout: TxOut[];
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
    transactions: LSBTransaction[];
    removed: LSBTransaction[];
    lastblock: string;
}

export const ListSinceBlock = (
        blockhash: string,
        targetConfirmations: number = 1,
        includeWatchonly: boolean = false,
        includeRemoved: boolean = true
): Promise<ListSinceBlockResult> =>
    Try<ListSinceBlockResult>(client.listSinceBlock(blockhash, targetConfirmations, includeWatchonly, includeRemoved));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: rawblindrawtransaction
//

export const RawBlindRawTransaction = (
        hexstring: string,
        inputamountblinders: string[],
        inputamounts: (number|string)[],
        inputassets: string[],
        inputassetblinders: string[],
        totalblinder?: string,
        ignoreblindfail: boolean = true)
: Promise<string> =>
    Try<string>(client.rawBlindRawTransaction(hexstring, inputamountblinders, inputamounts,
            inputassets, inputassetblinders, totalblinder, ignoreblindfail));

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
    errors?: SRTWWError[];
    warning?: string;
}

export const SignRawTransactionWithWallet = (
        hexstring: string,
        prevtxs?: SRTWWPrevTx[],
        sighashtype: SighashType = "ALL")
: Promise<SignRawTransactionWithWalletResult> =>
    Try<SignRawTransactionWithWalletResult>(client.signRawTransactionWithWallet(hexstring, prevtxs, sighashtype));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: sendrawtransaction
//

export const SendRawTransaction = (
        hexstring: string,
        allowhighfees: boolean = false)
: Promise<string> =>
    Try<string>(client.sendRawTransaction(hexstring, allowhighfees));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: unblindrawtransaction
//

export interface UnblindRawTransactionResult {
    hex: string;
}

export const UnblindRawTransaction = (hex: string)
: Promise<UnblindRawTransactionResult> =>
    Try<UnblindRawTransactionResult>(client.unblindRawTransaction(hex));

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
    subtractFeeFromOutputs?: number[];
    replaceable?: boolean;
    conf_target?: number;
    estimate_mode?: "UNSET" | "ECONOMICAL" | "CONSERVATIVE";
}

export interface FundRawTransactionResult {
    hex: string;
    fee: number;
    changepos: number;
}

export const FundRawTransaction = (
        hexstring: string,
        options?: FundRawTransactionOptions,
        iswitness?: boolean)
: Promise<FundRawTransactionResult> =>
    Do<FundRawTransactionResult>('fundRawTransaction', hexstring, options, iswitness);

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

export const CreateRawTransaction = (
        inputs: CRTInput[],
        outputs: CRTOutput[],
        locktime: number = 0,
        replaceable: boolean = false,
        outputAssets?: CRTOutputAssets)
: Promise<string> =>
    Try<string>(client.createRawTransaction(inputs, outputs, locktime, replaceable, outputAssets));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: decoderawtransaction
//

export const DecodeRawTransaction = (
        hexstring: string,
        iswitness?: boolean)
: Promise<Transaction> =>
    Do<Transaction>('decodeRawTransaction', hexstring, iswitness);

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getbalance
//

export type Balance = { [type: string]: number };

export const GetBalance = (
        dummy?: string,
        minconf: number = 0,
        includeWatchonly: boolean = false,
        assetlabel?: string)
: Promise<Balance> =>
    Try<Balance>(client.getBalance(dummy, minconf, includeWatchonly, assetlabel));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getunconfirmedbalance
//

export const GetUnconfirmedBalance = (): Promise<Balance> =>
    Try<Balance>(client.getUnconfirmedBalance());

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getnewaddress
//

export type AddressType = "legacy" | "p2sh-segwit" | "bech32";

export const GetNewAddress = (
        label?: string,
        addressType?: AddressType)
: Promise<string> =>
    Try<string>(client.getNewAddress(label, addressType));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: gettransaction
//

export interface GetTransactionResult extends WalletTxEntry {
    txid: string;
    details: WalletTxDetails[];
    hex: string;
    walletconflicts: string[];
}

export const GetTransaction = (
        txid: string,
        includeWatchonly: boolean = false)
: Promise<GetTransactionResult> =>
    Try<GetTransactionResult>(client.getTransaction(txid, includeWatchonly));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getblockhash
//

export const GetBlockHash = (height: number): Promise<string> => Try<string>(client.getBlockHash(height));

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
    tx: string[];
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
            extension_space: string[];
        },
        proposed: {
            signblockscript: string;
            max_block_witness: number;
            fedpegscript: string;
            extension_space: string[];
        };
    };
    previousblockhash: string;
    nextblockhash: string;
}

export const GetBlock0 = (hash: string): Promise<string> => Try<string>(client.getBlock(hash, 0));
export const GetBlock1 = (hash: string): Promise<BlockInfo> => Try<BlockInfo>(client.getBlock(hash, 1));

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
        addresses: string[] = [],
        includeUnsafe: boolean = true,
        queryOptions: ListUnspentQueryOptions = {}
    ): Promise<UTXO[]> =>
        Try<UTXO[]>(client.listUnspent(minconf, maxconf, addresses, includeUnsafe, queryOptions));

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
    pubkeys?: string[];
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
    labels: AddressLabel[];
}

export const GetAddressInfo = (address: string): Promise<AddressInfo> =>
    Try<AddressInfo>(client.getAddressInfo(address));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getrawchangeaddress
//

export const GetRawChangeAddress = (addressType?: AddressType): Promise<string> =>
    Try<string>(client.getRawChangeAddress(addressType));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: lockunspent
//

export const LockUnspent = (
        unlock: boolean,
        transactions?: Outpoint[])
: Promise<boolean> => Try<boolean>(client.lockUnspent(unlock, transactions));

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: listlockunspent
//

export const ListLockUnspent = (): Promise<Outpoint[]> => Try<Outpoint[]>(client.listLockUnspent());

//////////////////////////////////////////////////////////////////////////////////////////////////
// RPC: getblockcount
//

export const GetBlockCount = (): Promise<number> => Try<number>(client.getBlockCount());
