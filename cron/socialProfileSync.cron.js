const cron = require('node-cron');
const CreatorSocialAccount = require("../models/socialAccounts/creatorSocialAccount.model");
const {getProvider} = require("../modules/socialAccounts/providers/providerFactory");
const { decryptToken } = require("../utils/tokenCrypto");

const syncSocialProfiles = async () => {
    console.log("Social profile sync started");

    const accounts = await CreatorSocialAccount.findAll();

    for(const account of accounts)
    {
        try{
            const provider = getProvider(account.platform);
            const accessToken = decryptToken(account.accessToken);

            const profile = await provider.fetchProfile(accessToken);

            await account.update({
                username: profile.username,
                profileUrl: profile.profileUrl,
                followersCount: profile.followersCount,
                lastSyncedAt: new Date(),
            });

            console.log(`Synced ${account.platform} for creator ${account.creatorId}`);
        }catch(err)
        {
            console.error(`Failed syncing ${account.platform} for creator ${account.creatorId}:`, err.message);
        }
    }

    console.log("Social profile sync completed");
};

cron.schedule("0 3 * * *",async () => {
    await syncSocialProfiles();
});