class AnalyticsManager:
    def __init__(self):
        self.usage_data = []
        self.performance_data = []

    def track_usage(self, event_type, metadata=None):
        self.usage_data.append({
            'type': event_type,
            'metadata': metadata or {}
        })

    def track_performance(self, metric_name, value, metadata=None):
        self.performance_data.append({
            'metric': metric_name,
            'value': value,
            'metadata': metadata or {}
        })

    def get_usage_analytics(self):
        return self.usage_data

    def get_performance_analytics(self):
        return self.performance_data
