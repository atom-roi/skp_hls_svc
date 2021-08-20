const express = require('express');         // Express Web Server
const busboy = require('connect-busboy');   // Middleware to handle the file upload https://github.com/mscdex/connect-busboy
const path = require('path');               // Used for manipulation with path
const fs = require('fs-extra');             // Classic fs
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const hls = require('hls-server');


const app = express(); // Initialize the express web server
app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
})); // Insert the busboy middle-ware


ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Create route /upload which handles the post request
 */
app.route('/upload').post((req, res, next) => {

    req.pipe(req.busboy); // Pipe it trough busboy

    req.busboy.on('file', (fieldname, file, filename) => {
        console.log(`Upload of '${filename}' started`);
        const tmpDir = Date.now();
        const uploadPath = path.join(__dirname, 'videos/'+tmpDir);
         // Register the upload path
        fs.ensureDir(uploadPath); // Make sure that he upload path exits
        // Create a write stream of the new file
        const fstream = fs.createWriteStream(path.join(uploadPath, filename));
        // Pipe it trough
        file.pipe(fstream);

        // On finish of the upload
        fstream.on('close', () => {
            console.log(`Upload of '${filename}' finished`);


            //fs.ensureDir(uploadPath)
            // option 
            //ffmpeg -i Forest.mp4 -b:v 3M -level 3.0 -start_number 0 -f hls -g 60 -hls_time 10 -hls_list_size 0 -hls_segment_size 500000 output.m3u8
            //ffmpeg -i vid.mp4 -profile:v baseline -level 3.0 -start_number 0 -f hls -g 60 -hls_time 10 -hls_list_size 0 -hls_segment_size 500000 ./tmp/mym.m3u8
            ffmpeg(uploadPath +"/"+filename, { timeout: 432000 }).addOptions([
                '-profile:v baseline',
                //'-b:v 1M',              // ts 조각 사이즈
                '-level 3.0',
                '-start_number 0',
              // '-g 60',
                '-hls_time 5',             // 5초간격으로 분할
                '-hls_list_size 0',
              //  '-hls_segment_size 500000',
              //  '-hls_allow_cache 1',   //client 캐시 여부
                '-f hls'
            ]).output(uploadPath +'/output.m3u8').on('end', () => {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(`<a href="/player?id=${tmpDir}">--> ${filename} view</a>`);
                return res.end();
            }).run();
        });

    });
});


/**
 * Serve the basic index.html with upload form
 */
app.route('/').get((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'});
    res.write('<u>파일을 업로드 하면 자동으로 변환작업 후 동영상을 볼 수 있는 링크를 제공합니다.</u>');
    res.write('<br/>');
    res.write('<u>작은파일로 테스트 해주세요....</u>');
    res.write('<br/>');
    res.write('<form action="upload" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="fileToUpload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    return res.end();
});



app.get('/view', (req, res) => {
    var id = req.query.id;
    console.log(id);
    //res.render('player', {filename = id});
    return res.status(200).sendFile(`${__dirname}/client.html`);
});

app.get('/view2', (req, res) => {
    var id = req.query.id;
    console.log(id);
    //res.render('player', {filename = id});
    return res.status(200).sendFile(`${__dirname}/viewer.html`);
});

app.get('/player', (req, res) => {
    var id = req.query.id;
    console.log(id);
    //res.render('player', {filename = id});
    return res.status(200).sendFile(`${__dirname}/player.html`);
});
//app.setFfmpegPath('view engine', els);
const server = app.listen(3200, function () {
    console.log(`Listening on port ${server.address().port}`);
});


new hls(server, {
    provider: {
        exists: (req, cb) => {
            const ext = req.url.split('.').pop();

            if (ext !== 'm3u8' && ext !== 'ts') {
                return cb(null, true);
            }

            fs.access(__dirname + req.url, fs.constants.F_OK, function (err) {
                if (err) {
                    console.log('File not exist');
                    return cb(null, false);
                }
                cb(null, true);
            });
        },
        getManifestStream: (req, cb) => {
            const stream = fs.createReadStream(__dirname + req.url);
            cb(null, stream);
        },
        getSegmentStream: (req, cb) => {
            const stream = fs.createReadStream(__dirname + req.url);
            cb(null, stream);
        }
    }
});