export interface RPCHost {
    host: string;
    rpcport: number;
    user: string;
    pass: string;
}

export interface Configuration {
    elementsd: RPCHost;
};

const e = process.env;

export const config = {
    elementsd: {
        host: e.ELEMENTSD_HOST || 'localhost',
        rpcport:  e.ELEMENTSD_RPCPORT ? Number.parseInt(e.ELEMENTSD_RPCPORT, 10) : 16885,
        port: e.ELEMENTSD_PORT || '16886',
        user: e.ELEMENTSD_USER || 'user3',
        pass: e.ELEMENTSD_PASS || 'password3',
    },
};
