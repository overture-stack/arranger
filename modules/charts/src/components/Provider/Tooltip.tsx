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

import { css } from '@emotion/react';
import { PropsWithChildren } from 'react';

export const Tooltip = ({ children }: PropsWithChildren<{}>) => {
	return (
		<div
			css={css({
				fontFamily: 'Work Sans, sans-serif',
				fontSize: '11px',
				fontWeight: 'normal',
				fontStyle: 'normal',
				fontStretch: 'normal',
				lineHeight: '1.27',
				letterSpacing: 'normal',
				borderRadius: ' 2px',
				padding: '2px 4px',
				color: 'white',
				maxWidth: '100px',
				maxHeight: '100px',
				background: '#4f546d',

				'&:before': {
					content: '""',
					display: 'block',
					position: 'absolute',
					width: 0,
					height: 0,
					border: '5px solid transparent',
					pointerEvents: 'none',
					right: '50%',
					top: '100%',
					borderTopColor: '#4f546d',
					borderLeft: '5px solid transparent',
					borderRight: '5px solid transparent',
					marginLeft: '-5px',
				},
			})}
		>
			{children}
		</div>
	);
};
