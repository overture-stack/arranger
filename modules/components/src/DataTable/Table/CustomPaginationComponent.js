import React, { Component } from 'react'
import classnames from 'classnames'
import './style.css'

// import _ from './utils'

const defaultButton = props => (
  <button type="button" {...props} className="-btn">
    {props.children}
  </button>
)

class ReactTablePagination extends Component {
  constructor (props) {
    super()

    this.getSafePage = this.getSafePage.bind(this)
    this.changePage = this.changePage.bind(this)
    this.applyPage = this.applyPage.bind(this)

    this.state = {
      page: props.page,
    }
  }

  componentWillReceiveProps (nextProps) {
    this.setState({ page: nextProps.page })
  }

  getSafePage (page) {
    if (isNaN(page)) {
      page = this.props.page
    }
    return Math.min(Math.max(page, 0), this.props.pages - 1)
  }

  changePage (page) {
    page = this.getSafePage(page)
    this.setState({ page })
    if (this.props.page !== page) {
      this.props.onPageChange(page)
    }
  }

  applyPage (e) {
    if (e) { e.preventDefault() }
    const page = this.state.page
    this.changePage(page === '' ? this.props.page : page)
  }

  render () {
    const {
      // Computed
      pages,
      // Props
      page,
      showPageSizeOptions,
      pageSizeOptions,
      pageSize,
      showPageJump,
      canPrevious,
      canNext,
      onPageSizeChange,
      className,
      PreviousComponent = defaultButton,
      NextComponent = defaultButton,
    } = this.props

    return (
      <div
        className={classnames(className, '-pagination')}
        style={this.props.paginationStyle}
      >
        <div className="-previous">
          <PreviousComponent
            onClick={() => {
              if (!canPrevious) return
              this.changePage(page - 1)
            }}
            disabled={!canPrevious}
          >
            {this.props.previousText}
          </PreviousComponent>
        </div>
        <div className="-center">
          <span className="-pageInfo">
            {this.props.pageText}{' '}
            {showPageJump
              ? <div className="-pageJump">
                <input
                  type={this.state.page === '' ? 'text' : 'number'}
                  onChange={e => {
                    const val = e.target.value
                    const page = val - 1
                    if (val === '') {
                      return this.setState({ page: val })
                    }
                    this.setState({ page: this.getSafePage(page) })
                  }}
                  value={this.state.page === '' ? '' : this.state.page + 1}
                  onBlur={this.applyPage}
                  onKeyPress={e => {
                    if (e.which === 13 || e.keyCode === 13) {
                      this.applyPage()
                    }
                  }}
                />
              </div>
              : <span className="-currentPage">
                {page + 1}
              </span>}{' '}
            {this.props.ofText}{' '}
            <span className="-totalPages">{pages || 1}</span>
          </span>
          {showPageSizeOptions &&
            <span className="select-wrap -pageSizeOptions">
              <select
                onChange={e => onPageSizeChange(Number(e.target.value))}
                value={pageSize}
              >
                {pageSizeOptions.map((option, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <option key={i} value={option}>
                    {option} {this.props.rowsText}
                  </option>
                ))}
              </select>
            </span>}
        </div>
        <div className="-next">
          <NextComponent
            onClick={() => {
              if (!canNext) return
              this.changePage(page + 1)
            }}
            disabled={!canNext}
          >
            {this.props.nextText}
          </NextComponent>
        </div>
      </div>
    )
  }
}


export default class CustomPaginationComponent extends ReactTablePagination {
  handlePageClick(pageIndex){
    this.changePage(pageIndex)
  }
  render(){
    const {
      page,
      showPageSizeOptions,
      pageSizeOptions,
      pageSize,
      showPageJump,
      canPrevious,
      canNext,
      onPageSizeChange,
      className,
      PreviousComponent = defaultButton,
      NextComponent = defaultButton,
    } = this.props
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
        {
          (() => (
            // <ReactTablePagination {...this.props}></ReactTablePagination>
            ""
          ))()
        }
        {
          showPageSizeOptions &&
            <span className="select-wrap -pageSizeOptions">
              Show{' '}
              <select
                onChange={e => onPageSizeChange(Number(e.target.value))}
                value={pageSize}>
                {pageSizeOptions.map((option, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <option key={i} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {' '}{this.props.rowsText}
            </span>
        }
        {
          showPageJump
          ? (
            <span className="-pageJump">
              <span className="-toStart -pagination_button">{'<<'}</span>
              <span className="-previous -pagination_button">{'<'}</span>
              {[1, 2, 3].map((pageIndex, i) => (
                <span onClick={(e) => this.handlePageClick(pageIndex)} key={i} className="-pagination_button">{pageIndex}</span>
              ))}
              <span className="-next -pagination_button">{'>'}</span>
              <span className="-toEnd -pagination_button">{'>>'}</span>
            </span>
          )
          : (
            <span className="-currentPage">
              {page + 1}
            </span>
          )
        }
      </div>
    )
  }
}
