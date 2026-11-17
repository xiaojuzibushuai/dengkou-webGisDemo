/** 一张图地块/渠系字段中文释义（点击要素属性） */

export const ATTR_LABELS: Record<string, string> = {
  OBJECTID: '对象编号',
  UserID: '用户编号',
  OBJECTID_: '原对象编号',
  PROVINCIAL: '省（自治区）',
  CITY: '市',
  COUNTY: '县（旗）',
  IRRNAME: '灌区名称',
  IRRTYPE: '灌区类型',
  PTNAME: '地块/渠道名称',
  NAME: '渠道名称',
  REMARK: '备注',
  Shape_Leng: '周长（源投影单位）',
  SHAPE_Leng: '长度（源投影单位）',
  Shape_Area: '面积（源投影单位·平方米级）',
  PTAREA: '面积（亩，台账）',
  面积: '面积（平方米）',
  亩数: '亩数',
  ANGLE: '注记角度',
  DIRRAREA: '设计灌溉面积说明',
  RIRRAREA: '实灌面积说明',
  CLAREA: '耕地/分类面积说明',
}

export function labelOf(key: string): string {
  return ATTR_LABELS[key] || key
}
