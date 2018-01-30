/**
 *
 * Copyright (c) 2017 The Ontario Institute for Cancer Research. All rights reserved.
 *
 * This program and the accompanying materials are made available under the terms of the GNU Public License v3.0.
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES LOSS OF USE, DATA, OR PROFITS
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

"use strict";

const EQ = "=",
    NEQ = "!=",
    IN = "in",
    EXCLUDE = "exclude",
    EXCLUDE_IF_ANY = "excludeifany",
    GT = ">",
    GTE = ">=",
    LT = "<",
    LTE = "<=",
    AND = "and",
    OR = "or",
    IS = "is",
    NOT = "not",
    RANGE_OPS = {
        GT: GT,
        LT: LT,
        GTE: GTE,
        LTE: LTE
    },
    HAVE_OPS = [EQ, IN],
    HAVE_NOT_OPS = [NEQ, EXCLUDE],
    IS_OPS = [IS, NOT],
    GROUP_OPS = [AND, OR];

export const CONSTANTS = {
     EQ : EQ
    ,NEQ : NEQ
    ,IN : IN
    ,EXCLUDE : EXCLUDE
    ,EXCLUDE_IF_ANY : EXCLUDE_IF_ANY
    ,GT : GT
    ,GTE : GTE
    ,LT : LT
    ,LTE : LTE
    ,AND : AND
    ,OR : OR
    ,IS : IS
    ,NOT : NOT
    ,HAVE_OPS : HAVE_OPS
    ,HAVE_NOT_OPS : HAVE_NOT_OPS
    ,IS_OPS : IS_OPS
    ,VALUE_OPS : HAVE_OPS.concat(HAVE_NOT_OPS).concat([EXCLUDE_IF_ANY])
    ,MUST_OPS : HAVE_OPS.concat(IS_OPS)
    ,MUST_NOT_OPS : HAVE_NOT_OPS.concat([EXCLUDE_IF_ANY])
    ,GROUP_OPS : [AND, OR]
    ,RANGE_OPS : RANGE_OPS
    ,RANGE_OPS_KEYS : Object.keys(RANGE_OPS)
    ,ES_MUST : "must"
    ,ES_MUST_NOT : "must_not"
    ,ES_SHOULD : "should"
    ,ES_NESTED : "nested"
    ,ES_BOOL : "bool"
    ,ES_FILTER : "filter"
    ,ES_QUERY : "query"
    ,ES_PATH : "path"
    ,FIELD_TO_SET_TYPE : {
        "cases.case_id": "case_set",
        "files.file_id": "file_set",
        "genes.gene_id": "gene_set",
        "ssms.ssm_id": "ssm_set",
        "files.index_files.file_id": "file_set",
        "files.analysis.input_files.file_id": "file_set",
        "files.downstream_analyses.output_files.file_id": "file_set",
    }
    ,BUCKETS : 'buckets'
    ,STATS : 'stats'
    ,HISTOGRAM : 'histogram'
};
