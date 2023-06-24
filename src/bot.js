const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
const {
    VoiceConnectionStatus,
    createAudioResource,
    joinVoiceChannel,
    entersState
} = require("@discordjs/voice");
const ytsr = require("ytsr");
const play = require("play-dl");
const { readFile } = require("fs");

function createClient() {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
        ],
        partials: [
            Partials.Channel,
            Partials.Message,
            Partials.GuildMember,
        ] 
    });
}

async function retrieveBotInfo() {
    return new Promise((resolve, reject) => {
        readFile("./src/bot-config.json", "utf-8", (error, data) => {
            if(error) {
                console.error(`Error while reading the bot-config.json file... ${error}`);
                reject(error);
            }
            const map = new Map();

            //iterate over the object properties and add them to the map
            for (const [key, value] of Object.entries(JSON.parse(data))) {
                map.set(key, value);
            }

            resolve(map);
        });
    });
}

function createConnection(voiceChannel) {
    let connection;
    try {
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log("[+]Voice connection is ready!");
        });
    
        connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
            console.log("[-]Voice connection has been disconnected!");
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
                //seems to be reconnecting to a new channel - ignore disconnect
            } catch (error) {
                //seems to be a real disconnect which SHOULDN'T be recovered from
                connection.destroy();
                connection = null;
            }
        });

        connection.on(VoiceConnectionStatus.Destroyed, async (oldState, newState) => {
            console.log("[-]Voice connection has been destroyed!");
        });
    
        connection.on("error", error => {
            console.error(`[-]ERROR ON CONNECTION: ${error}`);
        });
    } catch(error) {
        console.error(error);
    }

    return connection;
}

async function search(query, limit = 1, type = "video") {
    const options = {
        limit: limit
    };
    const searchResults = await ytsr(query, options);

    //filter items with type "video"
    const filteredResults = searchResults.items.filter(item => {
        if(item.type === type) return item;
    });

    if (!filteredResults.length) return null;
    return filteredResults;
}

function parseVideoInfo(info) {
    const title = info.video_details.title;
    const channel = info.video_details.channel;
    const duration = info.video_details.durationRaw;

    return [title, channel, duration];
}

async function createResource(info) {
    try {
        const stream = await play.stream_from_info(info);
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type
        });
        return resource;
    } catch(error) {
        console.error(error);
    }
}

function sendEmbed(txtChannel, description, color, title = null, url = null) {
    return new Promise((resolve, reject) => {
        const embed = new EmbedBuilder();
        embed.setDescription(description);
        embed.setColor(color);
    
        if(title) embed.setTitle(title);
        if(url) embed.setThumbnail(url);
        if(title && url) {
            embed.setTitle(title);
            embed.setThumbnail(url);
        }

        txtChannel.send({ embeds: [embed] })
        .then(sentMsg => {
            resolve(sentMsg);
        })
        .catch(error => {
            reject(error);
        });
    });
}

module.exports = {
    createClient,
    retrieveBotInfo,
    createConnection,
    search,
    parseVideoInfo,
    createResource,
    sendEmbed
};