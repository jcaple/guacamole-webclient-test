
/**
 * This fixes a synchronous processing bug with the FileReader in the 
 * sendBlob function of the Guacamole.BlobWriter.  
 * 
 * https://issues.apache.org/jira/browse/GUACAMOLE-827
 * /

/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var Caple = Caple || {};

/**
 * A writer which automatically writes to the given output stream with the
 * contents of provided Blob objects.
 *
 * @constructor
 * @param {Guacamole.OutputStream} stream
 *     The stream that data will be written to.
 */
Caple.BlobWriter = function BlobWriter(stream) {

    /**
     * Reference to this Guacamole.BlobWriter.
     *
     * @private
     * @type {Guacamole.BlobWriter}
     */
    var guacWriter = this;

    /**
     * Wrapped Guacamole.ArrayBufferWriter which will be used to send any
     * provided file data.
     *
     * @private
     * @type {Guacamole.ArrayBufferWriter}
     */
    var arrayBufferWriter = new Caple.ArrayBufferWriter(stream);

    // Initially, simply call onack for acknowledgements
    arrayBufferWriter.onack = function(status) {
        if (guacWriter.onack)
            guacWriter.onack(status);
    };

    /**
     * Browser-independent implementation of Blob.slice() which uses an end
     * offset to determine the span of the resulting slice, rather than a
     * length.
     *
     * @private
     * @param {Blob} blob
     *     The Blob to slice.
     *
     * @param {Number} start
     *     The starting offset of the slice, in bytes, inclusive.
     *
     * @param {Number} end
     *     The ending offset of the slice, in bytes, exclusive.
     *
     * @returns {Blob}
     *     A Blob containing the data within the given Blob starting at
     *     <code>start</code> and ending at <code>end - 1</code>.
     */
    var slice = function slice(blob, start, end) {

        // Use prefixed implementations if necessary
        var sliceImplementation = (
                blob.slice
             || blob.webkitSlice
             || blob.mozSlice
        ).bind(blob);

        var length = end - start;

        // The old Blob.slice() was length-based (not end-based). Try the
        // length version first, if the two calls are not equivalent.
        if (length !== end) {

            // If the result of the slice() call matches the expected length,
            // trust that result. It must be correct.
            var sliceResult = sliceImplementation(start, length);
            if (sliceResult.size === length)
                return sliceResult;

        }

        // Otherwise, use the most-recent standard: end-based slice()
        return sliceImplementation(start, end);

    };

    /**
     * Sends the contents of the given blob over the underlying stream.
     *
     * @param {Blob} blob
     *     The blob to send.
     */
    this.sendBlob = function sendBlob(blob) {

        var offset = 0;
        var reader = new FileReader();

        // Ridgeline Bug Fix
        var sleep = function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Reads the next chunk of the blob provided to
         * [sendBlob()]{@link Guacamole.BlobWriter#sendBlob}. The chunk itself
         * is read asynchronously, and will not be available until
         * reader.onload fires.
         *
         * @private
         */
        var readNextChunk = async function readNextChunk() {

            // Ridgeline Bug Fix
            while (reader.readyState == 1) {
                // reader is busy so let it finish before proceeding
                await sleep(1000);
            }

            // If no further chunks remain, inform of completion and stop
            if (offset >= blob.size) {

                // Fire completion event for completed blob
                if (guacWriter.oncomplete)
                    guacWriter.oncomplete(blob);

                // No further chunks to read
                return;

            }

            // Obtain reference to next chunk as a new blob
            var chunk = slice(blob, offset, offset + arrayBufferWriter.blobLength);
            offset += arrayBufferWriter.blobLength;

            // Attempt to read the blob contents represented by the blob into
            // a new array buffer
            reader.readAsArrayBuffer(chunk);

        };

        // Send each chunk over the stream, continue reading the next chunk
        reader.onload = function chunkLoadComplete() {

            // Send the successfully-read chunk
            arrayBufferWriter.sendData(reader.result);

            // Continue sending more chunks after the latest chunk is
            // acknowledged
            arrayBufferWriter.onack = function sendMoreChunks(status) {

                if (guacWriter.onack)
                    guacWriter.onack(status);

                // Abort transfer if an error occurs
                if (status.isError())
                    return;

                // Inform of blob upload progress via progress events
                if (guacWriter.onprogress)
                    guacWriter.onprogress(blob, offset - arrayBufferWriter.blobLength);

                // Queue the next chunk for reading
                readNextChunk();

            };

        };

        // If an error prevents further reading, inform of error and stop
        reader.onerror = function chunkLoadFailed() {

            // Fire error event, including the context of the error
            if (guacWriter.onerror)
                guacWriter.onerror(blob, offset, reader.error);

        };

        // Begin reading the first chunk
        readNextChunk();

    };

    /**
     * Signals that no further text will be sent, effectively closing the
     * stream.
     */
    this.sendEnd = function sendEnd() {
        arrayBufferWriter.sendEnd();
    };

    /**
     * Fired for received data, if acknowledged by the server.
     *
     * @event
     * @param {Guacamole.Status} status
     *     The status of the operation.
     */
    this.onack = null;

    /**
     * Fired when an error occurs reading a blob passed to
     * [sendBlob()]{@link Guacamole.BlobWriter#sendBlob}. The transfer for the
     * the given blob will cease, but the stream will remain open.
     *
     * @event
     * @param {Blob} blob
     *     The blob that was being read when the error occurred.
     *
     * @param {Number} offset
     *     The offset of the failed read attempt within the blob, in bytes.
     *
     * @param {DOMError} error
     *     The error that occurred.
     */
    this.onerror = null;

    /**
     * Fired for each successfully-read chunk of data as a blob is being sent
     * via [sendBlob()]{@link Guacamole.BlobWriter#sendBlob}.
     *
     * @event
     * @param {Blob} blob
     *     The blob that is being read.
     *
     * @param {Number} offset
     *     The offset of the read that just succeeded.
     */
    this.onprogress = null;

    /**
     * Fired when a blob passed to
     * [sendBlob()]{@link Guacamole.BlobWriter#sendBlob} has finished being
     * sent.
     *
     * @event
     * @param {Blob} blob
     *     The blob that was sent.
     */
    this.oncomplete = null;

};

var Caple = Caple || {};

/**
 * A writer which automatically writes to the given output stream with arbitrary
 * binary data, supplied as ArrayBuffers.
 * 
 * @constructor
 * @param {Caple.OutputStream} stream The stream that data will be written
 *                                        to.
 */
Caple.ArrayBufferWriter = function(stream) {

    /**
     * Reference to this Caple.StringWriter.
     * @private
     */
    var guac_writer = this;

    // Simply call onack for acknowledgements
    stream.onack = function(status) {
        if (guac_writer.onack)
            guac_writer.onack(status);
    };

    /**
     * Encodes the given data as base64, sending it as a blob. The data must
     * be small enough to fit into a single blob instruction.
     * 
     * @private
     * @param {Uint8Array} bytes The data to send.
     */
    function __send_blob(bytes) {

        var binary = "";

        // Produce binary string from bytes in buffer
        for (var i=0; i<bytes.byteLength; i++)
            binary += String.fromCharCode(bytes[i]);

        // Send as base64
        stream.sendBlob(window.btoa(binary));

    }

    /**
     * The maximum length of any blob sent by this Caple.ArrayBufferWriter,
     * in bytes. Data sent via
     * [sendData()]{@link Caple.ArrayBufferWriter#sendData} which exceeds
     * this length will be split into multiple blobs. As the Caple protocol
     * limits the maximum size of any instruction or instruction element to
     * 8192 bytes, and the contents of blobs will be base64-encoded, this value
     * should only be increased with extreme caution.
     *
     * @type {Number}
     * @default {@link Caple.ArrayBufferWriter.DEFAULT_BLOB_LENGTH}
     */
    this.blobLength = Caple.ArrayBufferWriter.DEFAULT_BLOB_LENGTH;

    /**
     * Sends the given data.
     * 
     * @param {ArrayBuffer|TypedArray} data The data to send.
     */
    this.sendData = function(data) {

        var bytes = new Uint8Array(data);

        // If small enough to fit into single instruction, send as-is
        if (bytes.length <= guac_writer.blobLength)
            __send_blob(bytes);

        // Otherwise, send as multiple instructions
        else {
            for (var offset=0; offset<bytes.length; offset += guac_writer.blobLength)
                __send_blob(bytes.subarray(offset, offset + guac_writer.blobLength));
        }

    };

    /**
     * Signals that no further text will be sent, effectively closing the
     * stream.
     */
    this.sendEnd = function() {
        stream.sendEnd();
    };

    /**
     * Fired for received data, if acknowledged by the server.
     * @event
     * @param {Caple.Status} status The status of the operation.
     */
    this.onack = null;

};

/**
 * The default maximum blob length for new Caple.ArrayBufferWriter
 * instances.
 *
 * @constant
 * @type {Number}
 */
Caple.ArrayBufferWriter.DEFAULT_BLOB_LENGTH = 6048;

module.exports = Caple;