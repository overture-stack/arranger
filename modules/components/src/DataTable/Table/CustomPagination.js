import React, { Component } from 'react';
import classnames from 'classnames';
import { range, min, max } from 'lodash';
import './style.css';

export default class CustomPagination extends Component {
  constructor(props){
    super(props)
    this.state = {
      minPageShown: 0,
      maxPageShown: 10,
      page: props.page,
    };
  }

  getSafePage = page => {
    if (isNaN(page)) {
      page = this.props.page;
    }
    return Math.min(Math.max(page, 0), this.props.pages - 1);
  };

  changePage = page => {
    page = this.getSafePage(page);
    this.setState({ page });
    if (this.props.page !== page) {
      this.props.onPageChange(page);
    }
  };

  applyPage = e => {
    if (e) {
      e.preventDefault();
    }
    const page = this.state.page;
    this.changePage(page === '' ? this.props.page : page);
  };

  onPreviousPageClick = () => {
    this.changePage(max([this.state.page - 1, 0]));
    this.setState({
      minPageShown:
        this.state.page <= this.state.minPageShown
          ? max([this.state.minPageShown - 1, 0])
          : this.state.minPageShown,
      maxPageShown:
        this.state.page <= this.state.minPageShown
          ? this.state.minPageShown - 1 < 0
            ? this.state.maxPageShown
            : this.state.maxPageShown - 1
          : this.state.maxPageShown,
    });
  };

  onNextPageClick = () => {
    const { pages } = this.props;
    this.changePage(min([this.state.page + 1, pages]));
    this.setState({
      minPageShown:
        this.state.page >= this.state.maxPageShown - 1
          ? this.state.maxPageShown < pages
            ? this.state.minPageShown + 1
            : this.state.minPageShown
          : this.state.minPageShown,
      maxPageShown:
        this.state.page >= this.state.maxPageShown - 1
          ? min([this.state.maxPageShown + 1, pages])
          : this.state.maxPageShown,
    });
  };

  onStartPageClick = () => {
    this.changePage(0);
    this.setState({
      minPageShown: 0,
      maxPageShown: this.getNumPagesShown(),
    });
  };

  onEndPageClick = () => {
    const { pages } = this.props;
    this.changePage(pages - 1);
    this.setState({
      minPageShown: pages - this.getNumPagesShown(),
      maxPageShown: pages,
    });
  };

  // TODO: wat
  getNumPagesShown = () => 10;

  render() {
    const numPagesShown = this.state.maxPageShown - this.state.minPageShown;
    const {
      page,
      pages,
      showPageSizeOptions,
      pageSizeOptions,
      pageSize,
      showPageJump,
      canPrevious,
      canNext,
      onPageSizeChange,
      className,
      defaultButton = props => <button className="-btn" {...props} />,
      PreviousComponent = defaultButton,
      NextComponent = defaultButton,
    } = this.props;
    return (
      <div
        className={classnames(className, '-pagination')}
        style={{
          ...this.props.paginationStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {showPageSizeOptions && (
          <span className="select-wrap -pageSizeOptions">
            Show{' '}
            <select
              onChange={e => onPageSizeChange(Number(e.target.value))}
              value={pageSize}
            >
              {pageSizeOptions.map((option, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <option key={i} value={option}>
                  {option}
                </option>
              ))}
            </select>{' '}
            {this.props.rowsText}
          </span>
        )}
        {showPageJump && (
          <span className="-pageJump">
            <span
              className="-toStart -pagination_button"
              onClick={this.onStartPageClick}
            >
              {'<<'}
            </span>
            <span
              className="-previous -pagination_button"
              onClick={this.onPreviousPageClick}
            >
              {'<'}
            </span>
            {range(this.state.minPageShown, this.state.maxPageShown).map(
              pageIndex => (
                <span
                  key={pageIndex}
                  className={classnames(
                    '-pagination_button',
                    this.state.page === pageIndex ? '-current' : '',
                  )}
                  onClick={() => this.changePage(pageIndex)}
                >
                  {pageIndex + 1}
                </span>
              ),
            )}
            <span
              className="-next -pagination_button"
              onClick={this.onNextPageClick}
            >
              {'>'}
            </span>
            <span
              className="-toEnd -pagination_button"
              onClick={this.onEndPageClick}
            >
              {'>>'}
            </span>
          </span>
        )}
        {!showPageJump && <span className="-currentPage">{page + 1}</span>}
      </div>
    );
  }
}
