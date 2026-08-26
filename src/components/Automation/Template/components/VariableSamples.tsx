import { memo } from 'react';
import type { WhatsAppTemplateExample } from '../../../../types';
import { inputClass } from '../constants/templateConstants';

interface VariableSampleRowsProps {
  examples: WhatsAppTemplateExample[];
  onChange: (index: number, value: string) => void;
}

const VariableSampleRows = memo(function VariableSampleRows({ examples, onChange }: VariableSampleRowsProps) {
  return (
    <div className="space-y-2">
      {examples.map((example, index) => (
        <label key={example.name || index} className="grid min-w-0 grid-cols-[minmax(84px,35%)_minmax(0,1fr)] gap-2">
          <span className="flex min-h-10 items-center rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-semibold text-slate-500">
            {example.name ? `{{${example.name}}}` : `{{${index + 1}}}`}
          </span>
          <input
            required
            value={example.value}
            onChange={(event) => onChange(index, event.target.value)}
            placeholder="Nhập giá trị"
            className={`${inputClass} min-w-0`}
          />
        </label>
      ))}
    </div>
  );
});

interface VariableSamplesProps {
  headerExamples: WhatsAppTemplateExample[];
  bodyExamples: WhatsAppTemplateExample[];
  onHeaderChange: (index: number, value: string) => void;
  onBodyChange: (index: number, value: string) => void;
}

export const VariableSamples = memo(function VariableSamples({
  headerExamples,
  bodyExamples,
  onHeaderChange,
  onBodyChange,
}: VariableSamplesProps) {
  return (
    <section className="space-y-4 rounded-xl bg-slate-50 p-4">
      <div>
        <h4 className="text-sm font-bold text-slate-900">Mẫu biến</h4>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          Thêm một giá trị mẫu cho mỗi biến để Meta có thể xem xét mẫu của bạn. Các giá trị mẫu chỉ được dùng cho mục đích kiểm duyệt và sẽ không được gửi đến khách hàng. Hãy nhớ không sử dụng bất kỳ thông tin nào của khách hàng để bảo vệ quyền riêng tư của họ.
        </p>
      </div>
      {headerExamples.length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-slate-800">Tiêu đề</h5>
          <VariableSampleRows examples={headerExamples} onChange={onHeaderChange} />
        </div>
      ) : null}
      {bodyExamples.length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-xs font-bold text-slate-800">Nội dung</h5>
          <VariableSampleRows examples={bodyExamples} onChange={onBodyChange} />
        </div>
      ) : null}
    </section>
  );
});
