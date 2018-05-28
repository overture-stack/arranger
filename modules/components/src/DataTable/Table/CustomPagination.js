import React from 'react';
import classnames from 'classnames';
import { range } from 'lodash';
import ReactTablePagination from 'react-table/lib/pagination';

export default class CustomPagination extends ReactTablePagination {
  onPreviousPageClick = () => {
    const { canPrevious, page } = this.props;
    if (!canPrevious) return;
    this.changePage(page - 1);
  };

  onNextPageClick = () => {
    const { page, canNext } = this.props;
    if (!canNext) return;
    this.changePage(page + 1);
  };

  onStartPageClick = () => {
    if (!this.props.canPrevious) return;
    this.changePage(0);
  };

  onEndPageClick = () => {
    if (!this.props.canNext) return;
    const { pages } = this.props;
    this.changePage(pages - 1);
  };

  render() {
    const {
      page,
      pages,
      showPageSizeOptions,
      pageSizeOptions,
      pageSize,
      showPageJump,
      onPageSizeChange,
      className,
      canPrevious,
      canNext,
      maxPagesOptions = 10,
    } = this.props;

    const firstPage = Math.floor(
      Math.max(
        Math.min(page - maxPagesOptions / 2, pages - maxPagesOptions),
        0,
      ),
    );
    const lastPage = Math.floor(Math.min(firstPage + maxPagesOptions, pages));
    return (
      <div
        className={classnames(className, '-pagination')}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...this.props.paginationStyle,
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
              className={`-toStart -pagination_button ${
                canPrevious ? '' : '-disabled'
              }`}
              onClick={this.onStartPageClick}
            >
              {'<<'}
            </span>
            <span
              className={`-previous -pagination_button ${
                canPrevious ? '' : '-disabled'
              }`}
              onClick={this.onPreviousPageClick}
            >
              {'<'}
            </span>
            {range(firstPage, lastPage).map(pageIndex => (
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
            ))}
            <span
              className={`-next -pagination_button ${
                canNext ? '' : '-disabled'
              }`}
              onClick={this.onNextPageClick}
            >
              {'>'}
            </span>
            <span
              className={`-toEnd -pagination_button ${
                canNext ? '' : '-disabled'
              }`}
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
