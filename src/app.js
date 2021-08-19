const app = require('express')();
const fs = require('fs-extra');
const hls = require('hls-server');
const busboy = require('connect-busboy'); 
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fileUpload = require('express-fileupload'); 
const path = require('path');  




app.use(fileUpload());
ffmpeg.setFfmpegPath(ffmpegInstaller.path);


app.use(busboy({
    highWaterMark: 2 * 1024 * 1024, // Set 2MiB buffer
})); // Insert the busboy middle-ware

app.get('/', (req, res) => {
    return res.status(200).sendFile(`${__dirname}/client.html`);
});
app.get('/fileupload', (req, res) => {
    return res.status(200).sendFile(`${__dirname}/fileUpload.html`);
});


/**
 * Serve the basic index.html with upload form
 */
 app.route('/up').get((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('<form action="uploadLF" method="post" enctype="multipart/form-data">');
    res.write('<input type="file" name="fileToUpload"><br>');
    res.write('<input type="submit">');
    res.write('</form>');
    return res.end();
});


const uploadPath = path.join(__dirname, 'videos/'); // Register the upload path//
//fs.ensureDir(uploadPath); // Make sure that he upload path exits
/**
 * Create route /upload which handles the post request
 */
 app.route('/uploadLF').post((req, res, next) => {

    req.pipe(req.busboy); // Pipe it trough busboy
  
    req.busboy.on('file', (fieldname, file, filename) => {
        console.log(`Upload of '${filename}' started`);

        // Create a write stream of the new file
        const fstream = fs.createWriteStream(path.join(uploadPath, filename));
        // Pipe it trough
        file.pipe(fstream);

        // On finish of the upload
        fstream.on('close', () => {
            console.log(`Upload of '${filename}' finished`);
            res.redirect('back');
        });
    });
});



app.post('/upload', function(req, res) {
    let sampleFile;
    let uploadPath;
    console.log(req.files.sampleFile);
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }
  
    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    sampleFile = req.files.sampleFile;
    uploadPath = __dirname + '/videos/tmp/' + sampleFile.name;
  
    // Use the mv() method to place the file somewhere on your server
    // file upload 후 
    sampleFile.mv(uploadPath, function(err) {
      if (err)
        return res.status(500).send(err);
  
      //res.send('File uploaded!');


        ffmpeg(uploadPath, { timeout: 432000 }).addOptions([
            '-profile:v baseline',
            '-level 3.0',
            '-start_number 0',
            '-hls_time 10',
            '-hls_list_size 0',
            '-f hls'
        ]).output(__dirname + '/videos/tmp/output.m3u8').on('end', () => {
            res.send("MOVIE File Generated...")
        }).run();
    });
  });



const server = app.listen(3000, function () {
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