import React, { Component } from 'react';
import ReactDOM, { render } from 'react-dom';
import { PageHeader, Panel, Button, Col, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import Dropzone from 'react-dropzone'
import ReactHtmlParser, { processNodes, convertNodeToElement, htmlparser2 } from 'react-html-parser';

import styles from './styles.css'


class App extends Component {
  render() {
    return (
      <div>
        <Diff />
        <Panel bsSize="small">Copyright (c) 2017 Youichi Fujimoto</Panel>
      </div>
    );
  }
}


class DiffPane extends Component {
  constructor() {
    super()
    this.state = {
      file: null,
    }
  }

  onDrop(files) {
    const file = files[0];
    this.setState({
      file: file
    });

    if (this.props.onDrop) {
      this.props.onDrop(this, file);
    }
  }

  render() {
    let view = null;
    if (!this.props.content) {
      view = (<Dropzone
          accept="text/*, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onDrop={this.onDrop.bind(this)} >
        {this.state.file ? <div>
          <div>アップロードの準備ができました。</div>
          <div>{this.state.file.name}</div>
        </div> : <p>ここにファイルをドロップするか、クリックしてファイルを選択して下さい。</p>}
      </Dropzone>);
    } else {
      const elts = ReactHtmlParser(this.props.content);
      const pre_cls = this.props.multiline ? styles.multi_line : styles.diff_pane;

      view = (<div>
        <div className={styles.filename}>{this.state.right_filename}</div>
        <pre className={pre_cls}>{ elts }</pre>
      </div>);
    }

    return view;
  }
}


class DiffMapping extends Component {
  constructor() {
    super()
  }

  render() {
    var polys = null;
    if (this.props.diff_pair_polys) {
      polys = this.props.diff_pair_polys.map((poly) => {
        return <polygon key={poly.key} fill="#FCC" stroke="#E99" strokeWidth="1" 
                        points={poly.points.join(' ')} />
      });
    }

    let viewbox = null
    if (this.props.diff_height)
      viewbox = "0 0 100 " + this.props.diff_height;

    return (
      <svg version="1.1" height={this.props.diff_height}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={viewbox}
          preserveAspectRatio="none"
          className={styles.svg_outer} >
        {polys}
      </svg>
    );
  }
}


class Diff extends Component {
  constructor() {
    super()
    this.state = {
      dropped_panes: [],
      left_content: null,
      right_content: null,
      left_filename: null,
      right_filename: null,
      diff_pairs: null,
      diff_pair_polys: null,
      diff_height: null,
      can_compare: false,
      multiline: false
    }
  }

  componentDidUpdate() {
    if (this.state.diff_pairs && !this.state.diff_pair_polys) {
      let polys = [];
      let lr = ReactDOM.findDOMNode(this.leftPane).getBoundingClientRect();
      let rr = ReactDOM.findDOMNode(this.rightPane).getBoundingClientRect();
      let max_height = 0;
      for (let pair of this.state.diff_pairs) {
        const dna = ReactDOM.findDOMNode(this.leftPane.refs[pair[0]]);
        const dnb = ReactDOM.findDOMNode(this.rightPane.refs[pair[1]]);
        if (!dna || !dnb) {
          console.log("DOM node not found");
          console.log(pair);
          continue;
        }
        let ra = dna.getBoundingClientRect();
        let rb = dnb.getBoundingClientRect();
        ra.y = ra.y - lr.y;
        rb.y = rb.y - rr.y;
        polys.push({
          key: pair.join(),
          points: [
            0 + ',' + (ra.y),
            100 + ',' + rb.y,
            100 + ',' + (rb.y + rb.height),
            0 + ',' + (ra.y + ra.height)
          ]
        });
        max_height = Math.max(max_height, ra.y + ra.height, rb.y + rb.height)
      }

      this.setState({
        diff_pair_polys: polys,
        diff_height: max_height
      })
    }
  }

  onDrop(pane) {
    let dropped_panes = this.state.dropped_panes;
    if (!dropped_panes.includes(pane)) {
      dropped_panes.push(pane);
      console.log(dropped_panes);
      this.setState({
        dropped_panes: dropped_panes,
        can_compare: dropped_panes.length < 2 ? false : true
      });
    }
  }

  onChangeMultiline(values) {
    let multiline = false;
    if (values.length > 0) {
      multiline = true;
    }

    this.setState({
      diff_pair_polys: null,
      multiline: multiline
    });
  }

  _postCompare(formData) {
    //return fetch('/diff/compare/test01');
    return fetch('/diff/compare', {
      method: 'POST',
      body: formData
    });
  }

  doCompare() {
    if (this.state.dropped_panes.length < 2) {
      console.log('cant happen...')
      return;
    }

    var formData = new FormData();
    formData.append('file[0]', this.state.dropped_panes[0].state.file);
    formData.append('file[1]', this.state.dropped_panes[1].state.file);
    console.log(formData);

    this._postCompare(formData)
      .then(response => response.json())
      .then(data => {
        // Ugh!: debug
        console.log(data);
        this.setState({
          left_content: data.left_result,
          right_content: data.right_result,
          left_filename: data.left_filename,
          right_filename: data.right_filename,
          diff_pairs: data.diff_lines
        });
      });
  }

  render() {
    let btn_style = this.state.can_compare ? "primary" : null;

    return (
      <div>
        <PageHeader>Word(docx)ファイル比較</PageHeader>
        <Panel header="このツールについて">左右にファイルを一つずつドロップして、「比較する」ボタンを押すとファイルの内容の差分が赤く表示されます。
        行が横に長過ぎる場合は「行を折り返す」をオンにすることで見やすくなります。</Panel>
        <Col sm={12} md={12}>
          <Button bsSize="large" bsStyle={btn_style} onClick={this.doCompare.bind(this)}>
            比較する
          </Button>
          <ToggleButtonGroup type="checkbox" onChange={this.onChangeMultiline.bind(this)}>
            <ToggleButton value="hoge" bsSize="small">行を折り返す</ToggleButton>
          </ToggleButtonGroup>
          <div class="row">&nbsp;</div>
        </Col>
        <Col sm={5} md={5} ref="left-outer" className={styles.pane_outer}>
          <DiffPane ref={(ref) => this.leftPane = ref}
            onDrop={this.onDrop.bind(this)}
            filename={this.state.left_filename}
            content={this.state.left_content}
            multiline={this.state.multiline} />
        </Col>
        <Col sm={2} md={2}>
          <DiffMapping
            diff_pair_polys={this.state.diff_pair_polys}
            diff_height={this.state.diff_height} />
        </Col>
        <Col sm={5} md={5} ref="right-outer" className={styles.pane_outer}>
          <DiffPane ref={(ref) => this.rightPane = ref}
            onDrop={this.onDrop.bind(this)}
            filename={this.state.right_filename}
            content={this.state.right_content}
            multiline={this.state.multiline} />
        </Col>
      </div>
    );
  }
}


render((
  <App/>
), document.querySelector('#root'));

