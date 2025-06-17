/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
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
 */

import { css } from '@emotion/react';
import range from 'lodash/range';

const dotsCount = 5;

export const DnaLoader = () => (
	<div
		css={css`
			padding-top: 15px;
			padding-bottom: 15px;
			width: ${dotsCount * 10}px;

			div:nth-of-type(odd) {
				position: absolute;
			}
			div:nth-of-type(even) {
				width: ${dotsCount * 10}px;
			}
			span {
				display: inline-block;
				position: relative;
				width: 10px;
				height: 10px;
				background-color: white;
				border-radius: 50%;
				transform: scale(0, 0);
			}

			${range(1, dotsCount + 1).map(
				(i) => css`
					div:nth-of-type(odd) span:nth-of-type(${i}) {
						animation: animateFirstDots 0.8s ease-in-out infinite;
						animation-direction: alternate;
						animation-delay: ${i * 0.2}s;
					}
					div:nth-of-type(even) span:nth-of-type(${i}) {
						animation: animateSecondDots 0.8s ease-in-out infinite;
						animation-direction: alternate-reverse;
						animation-delay: ${i * 0.2}s;
					}
				`,
			)}

			@keyframes animateFirstDots {
				0% {
					transform: translateY(200%) scale(0.7, 0.7);
					background-color: #24dbb4;
				}
				100% {
					transform: translateY(-200%) scale(1, 1);
					background-color: #0774d3;
				}
			}
			@keyframes animateSecondDots {
				0% {
					transform: translateY(200%) scale(0.7, 0.7);
					background-color: #f95d31;
				}
				100% {
					transform: translateY(-200%) scale(1, 1);
					background-color: #fea430;
				}
			}
		`}
	>
		<div>
			{range(0, dotsCount).map((i) => (
				<span key={i} />
			))}
		</div>
		<div>
			{range(0, dotsCount).map((i) => (
				<span key={i} />
			))}
		</div>
	</div>
);
