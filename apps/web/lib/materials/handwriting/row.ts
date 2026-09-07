import { createHash } from 'node:crypto';
import { PROFILE_SOURCE } from './profile';

const PIN = 'abc4d2e994b928fd27a940550a6f0210de079441d3b33bf147feee4783da2ccc';
type Command = [string, ...number[]];
type Glyph = { advance: number; bounds: [number,number,number,number] | null; commands: Command[]; contours: number };
type Profile = { id: string; glyphs: Record<string,Glyph>; units: Record<string,number> };
export class GuidedRowError extends Error {
  constructor(readonly code: 'profile_invalid'|'input_invalid'|'unsupported_character'|'text_does_not_fit', message: string) { super(message); }
}
export function loadProfile(bytes?: Uint8Array, readBytes: () => Uint8Array = () => Buffer.from(PROFILE_SOURCE, 'utf8')): Profile {
  try {
    const source=bytes??readBytes();
    if(createHash('sha256').update(source).digest('hex')!==PIN) throw new Error('profile checksum mismatch');
    return JSON.parse(Buffer.from(source).toString('utf8'));
  } catch {
    throw new GuidedRowError('profile_invalid','The pinned outline profile is unavailable or invalid.');
  }
}
let cachedProfile: Profile | undefined;
export type GuidedRowInput = { id: string; text: string; style: 'model'|'pale'|'dotted'|'independent'; capHeight: number; width?: number };
const escapeXml=(text:string)=>text.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[character]!));
const number=(x:number)=>Number(x.toFixed(6));
const path=(commands:Command[])=>commands.map(command=>command[0]+command.slice(1).map(value=>number(value as number)).join(' ')).join('');

export function guidedRow(input: GuidedRowInput) {
  const profile=cachedProfile??=loadProfile();
  const {id,text,style,capHeight}=input;
  const width=input.width??700;
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(id)||!['model','pale','dotted','independent'].includes(style)||typeof text!=='string'||text.length>32||text!==text.normalize('NFC')||!Number.isFinite(capHeight)||capHeight<64||capHeight>128||!Number.isFinite(width)||width<240||width>700) throw new GuidedRowError('input_invalid','Use a unique safe row ID, NFC text up to 32 characters, a supported style and bounded physical dimensions.');
  if(style==='independent' ? text!=='' : !text.trim() || text!==text.trim()) throw new GuidedRowError('input_invalid','Independent rows require empty text; guided text must be nonempty without edge spaces.');
  const scale=capHeight/128;
  const baseline=(48+128)*scale;
  const height=(48+128+72)*scale;
  const padding=8;
  const minGap=capHeight*0.08;
  let cursor=padding,previousRight=padding-minGap;
  const glyphReceipts: {character:string;index:number;x:number;bounds:number[]|null;profileBounds:Glyph['bounds'];pathSha256:string}[]=[];
  const paths:string[]=[];
  const ink=style==='pale'?'#c9c2b8':'#252525';
  for(const [index,character] of Array.from(text).entries()) {
    if(!Object.hasOwn(profile.glyphs,character)) throw new GuidedRowError('unsupported_character',`Unsupported character at position ${index+1}. No font fallback is available.`);
    const glyph=profile.glyphs[character];
    if(glyph.bounds) {
      cursor=Math.max(cursor,previousRight+minGap-glyph.bounds[0]*scale);
      const bounds=[cursor+glyph.bounds[0]*scale,baseline-glyph.bounds[3]*scale,cursor+glyph.bounds[2]*scale,baseline-glyph.bounds[1]*scale];
      if(bounds[0]<padding-0.001||bounds[2]>width-padding||bounds[1]<2||bounds[3]>height-2) throw new GuidedRowError('text_does_not_fit','This row does not fit at the requested guide height. Use another layout without shrinking or changing the text.');
      const d=path(glyph.commands);
      paths.push(`<path data-glyph-index="${index}" d="${d}" transform="translate(${number(cursor)} ${number(baseline)}) scale(${number(scale)} ${number(-scale)})" ${style==='dotted'?`fill="none" stroke="${ink}" stroke-width="0.9" stroke-dasharray="2.4 2.8" stroke-linecap="round" stroke-linejoin="round"`:`fill="${ink}"`}/>`);
      glyphReceipts.push({character,index,x:number(cursor),bounds:bounds.map(number),profileBounds:glyph.bounds,pathSha256:createHash('sha256').update(d).digest('hex')});
      previousRight=bounds[2];
    } else glyphReceipts.push({character,index,x:number(cursor),bounds:null,profileBounds:null,pathSha256:createHash('sha256').update('').digest('hex')});
    cursor += glyph.advance*scale;
  }
  if(cursor>width-padding) throw new GuidedRowError('text_does_not_fit','This row does not fit at the requested guide height. Use another layout without shrinking or changing the text.');
  const guides={cap:48*scale,xHeight:(48+64)*scale,baseline,descender:baseline+64*scale};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" data-guided-row="${id}" role="img" aria-labelledby="${id}-title" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;width:${width}px;height:${height}px;max-width:none;overflow:visible"><title id="${id}-title">${escapeXml(style==='independent'?'Independent writing guides':text)}</title><g fill="none" stroke="#777" stroke-width="1"><path d="M0 ${number(guides.cap)}H${width}"/><path d="M0 ${number(guides.xHeight)}H${width}" stroke-dasharray="6 5"/><path d="M0 ${number(guides.baseline)}H${width}"/><path d="M0 ${number(guides.descender)}H${width}" stroke="#bbb" stroke-dasharray="2 5"/></g>${paths.join('')}</svg>`;
  return {svg,receipt:{id,text,style,profileId:profile.id,profileSha256:PIN,width,height,capHeight,guideHeightIn:capHeight/96,guideHeightPoints:capHeight*0.75,guides,glyphs:glyphReceipts,runAdvance:number(cursor-padding),horizontalScaling:1}};
}
