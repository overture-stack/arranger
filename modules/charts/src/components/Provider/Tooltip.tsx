/*
 * Copyright (c) 2025 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 * If not, see <http://www.gnu.org/licenses/>.
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

import { PropsWithChildren } from 'react';

export const Tooltip = ({ children }: PropsWithChildren<{}>) => {
	return (
		<>
			<style>
				{`'.chart-tooltip &:before': {
						content: '""',
						display: 'block',
						position: 'absolute',
						width: 0,
						height: 0,
						border: '5px solid transparent',
						pointerEvents: 'none',
						right: '50%',
						top: '100%',
						borderTopColor: theme.colors.primary_1,
						borderLeft: '5px solid transparent',
						borderRight: '5px solid transparent',
						marginLeft: '-5px',
					}`}
			</style>

			<div
				className="chart-tooltip"
				style={{
					borderRadius: ' 2px',
					padding: '2px 4px',
					color: 'white',
					maxWidth: '100px',
					maxHeight: '100px',
					background: '#4f546d',
				}}
			>
				{children}
			</div>
		</>
	);
};
