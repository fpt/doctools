#!/usr/bin/env python
# coding:utf-8

import sys,os
import socket
from flask import Flask, g,render_template, make_response, jsonify, send_file
from flask import request, redirect
from flask import Response
from io import BytesIO
from zipfile import ZipFile

sys.path.append('src')

from diff import TextDiff
from docreader import DocReader
from strings import Strings


app = Flask(__name__)
app.debug = True
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024


# index
@app.route('/', methods=["GET"])
def index():
    return render_template('index.html')


def diff_compare(fn1, body1, fn2, body2):
    td = TextDiff()
    file1_rslt, file2_rslt, diff_lines = td.compare(body1, body2)

    res = {
        'result' : 'ok',
        'left_filename' : fn1,
        'left_result' : file1_rslt,
        'right_filename' : fn2,
        'right_result' : file2_rslt,
        'diff_lines' : diff_lines,
    }
    return jsonify(res)


@app.route('/diff/compare/test01')
def diff_compare_test01():
    body1 = """A brown fox
jumped into
a pond.""".splitlines()
    body2 = """A yellow fox
quickly
jumped into
a cave.""".splitlines()
    return diff_compare('bp', body1, 'yc', body2)


@app.route('/diff/compare', methods=["POST"])
def diff_compare_files():
    def is_docx(file):
        docx_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        return file.filename.endswith('.docx') and file.content_type == docx_mime
    def is_text(file):
        return file.content_type.startswith('text/')

    if request.method == 'POST':
        files = []
        for k, v in request.files.items():
            if k.startswith('file'):
                files.append(v)
        if not files or len(files) != 2:
            flash('Not enough files')
            return redirect('/diff')
        for f in files:
            if not f.filename:
                flash('No selected file')
                return redirect('/diff')

        file1, file2 = files
        body1 = None
        body2 = None
        print(file1)
        print(file2)
        if is_docx(file1) and is_docx(file2):
            dr = DocReader()
            body1 = list(dr.process(file1.stream))
            body2 = list(dr.process(file2.stream))
        elif is_text(file1) and is_text(file2):
            body1 = file1.stream.read().decode("utf-8").splitlines()
            body2 = file2.stream.read().decode("utf-8").splitlines()
        else:
            flash('unsupported.')

        return diff_compare(files[0].filename, body1, files[1].filename, body2)


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)


# http://flask.pocoo.org/docs/0.11/patterns/streaming/
