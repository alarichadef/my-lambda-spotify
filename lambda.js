const https = require('https');
const querystring = require('querystring');

async function build_image(url, type, params) {
    let options = {
        encoding: null,
        method: 'GET'
    };
    let rep = await new Promise((resolve, reject) => {
        https.get(url, options, (res) => {
            let data = [];
            res.on('data', (d) => {
                data.push(d);
            });
            res.on('end', () => {
                let img = 'data:' + res.headers['content-type'] + ';base64,' + Buffer.concat(data).toString('base64');
                let svg = '<svg version="1.1" height="400px" width="600px" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';
                if (type === 0) {
                    svg += `<text font-family="Arial, Helvetica, sans-serif" x="0" y="15">Currently listening to nothing but here's my artist of the month </text>
                <text fill="blue" font-family="Arial, Helvetica, sans-serif" x="0" y="32">${params.artist}</text><image xlink:href="${img}" x="0" y="45" height="350px" width="350px"/>`;
                } else {
                    svg += `<text font-family="Arial, Helvetica, sans-serif" x="0" y="15">What am I listening to right now on spotify ? </text><image xlink:href="${img}" x="0" y="25" height="300px" width="300px"/><text font-family="Arial, Helvetica, sans-serif" x="310" y="40">${params.song}</text><text font-family="Arial, Helvetica, sans-serif" x="310" y="60" fill="red">By ${params.artist}</text>`;
                }
                svg += '</svg>';
                let response = {
                    statusCode: 200,
                    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-cache' },
                    body: svg
                };
                return resolve(response);
            });
        });
    });
    return rep;
}

function currently_listening(json) {
    if (json.item.album) {
        if (json.item.album.images && json.item.album.images.length) {
            let url = json.item.album.images[0].url;
            let song = json.item.name;
            let artist = json.item.album.artists[0].name;
            return build_image(url, 1, { song, artist });
        }
    }
}

async function top_artist(token) {
    let options = {
        hostname: 'api.spotify.com',
        port: 443,
        path: '/v1/me/top/artists?time_range=short_term',
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + token
        }
    };
    let rep = await new Promise((resolve, reject) => {
        https
            .get(options, (res) => {
                let data = '';
                res.on('data', (d) => {
                    data += d;
                });
                res.on('end', () => {
                    const json = JSON.parse(data);
                    const image_url = json.items[0].images[0].url;
                    const artist = json.items[0].name;
                    return resolve(build_image(image_url, 0, { artist }));
                });
            })
            .on('error', (e) => {
                console.error('error =>', e);
            });
    });
    return rep;
}

exports.handler = async (event) => {
    const authorization = 'Basic ' + Buffer.from(`${process.env.clientId}:${process.env.clientSecret}`).toString('base64');

    const data = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: process.env.refreshToken
    });

    let options = {
        hostname: 'accounts.spotify.com',
        port: 443,
        path: '/api/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: authorization
        }
    };
    const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (_data) => {
                data += _data;
            });
            res.on('end', () => {
                const token = JSON.parse(data).access_token;
                options = {
                    hostname: 'api.spotify.com',
                    port: 443,
                    path: '/v1/me/player/currently-playing',
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + token
                    }
                };
                https
                    .get(options, (res) => {
                        let data = '';
                        res.on('data', (d) => {
                            data += d;
                        });
                        res.on('end', () => {
                            if (data) {
                                let json = JSON.parse(data);
                                return resolve(currently_listening(json));
                            } else {
                                return resolve(top_artist(token));
                            }
                        });
                    })
                    .on('error', (e) => {
                        console.error(e);
                    });
            });
        });

        req.write(data);
        req.end();

        req.on('error', (error) => {
            console.error(error);
        });
    });
    return response;
};
