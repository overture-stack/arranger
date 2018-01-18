
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
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

"use strict";
import jsf from 'json-schema-faker'

/*
    Customized json-schema-faker
 */
export default class SchemaFaker{
    constructor(schema){
        this.customizeFaker();
        return jsf(schema);
    }
    customizeFaker(){
        jsf.format('md5', function(gen, schema) {
            return gen.randexp('^[a-f0-9]{32}$');
        });
        jsf.format('accession', function(gen, schema) {
            return gen.randexp('^[a-z]{3}[0]{5}[0-9]{1}\.(v)[0-9]{2}\.(p)[0-1]{2}$');
        });
        jsf.format('datasetname', function(gen, schema) {
            return gen.randexp('^[A-Z]\\w*(_)*[A-Za-z]\\w*(_)*[A-Za-z]$');
        });
    }
}